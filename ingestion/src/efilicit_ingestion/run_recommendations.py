"""Orquestación del job de recomendaciones (ADR 034).

- dry-run (default): fixtures en memoria, sin DB.
- write: Postgres real (EFILICIT_DATABASE_URL).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from efilicit_ingestion.pipeline.postgres import connect
from efilicit_ingestion.recommendations.models import CandidateTender, Recommendation
from efilicit_ingestion.recommendations.dedupe import (
    dedupe_recommendations_by_tender,
)
from efilicit_ingestion.recommendations.postgres import (
    PROFILES,
    list_user_ids,
    load_candidates,
    load_user_seed_inputs,
    replace_user_recommendations,
    seed_cpv_prefixes,
)
from efilicit_ingestion.recommendations.score import rank_candidates
from efilicit_ingestion.recommendations.seeds import (
    FavoriteRow,
    OfferCaseRow,
    RatingRow,
    build_seeds_for_profile,
    count_personal_seeds,
)


@dataclass(frozen=True, slots=True)
class RecommendationsRunConfig:
    dry_run: bool = True
    user_id: str | None = None  # si se indica, solo ese usuario


@dataclass
class RecommendationsRunResult:
    dry_run: bool
    users: int = 0
    written: int = 0
    by_profile: dict[str, int] = field(default_factory=dict)
    skipped_cold: int = 0


def _fixture_inputs() -> dict:
    ratings = [
        RatingRow(
            "11111111-1111-4111-8111-111111111111",
            5,
            "propia",
            title="Auditoría energética de alumbrado público",
            cpv_codes=("71314000",),
            contract_type="servicios",
            estimated_value=Decimal("45000"),
        ),
        RatingRow(
            "22222222-2222-4222-8222-222222222222",
            4,
            "propia",
            title="Proyecto de renovación LED",
            cpv_codes=("71321000",),
            contract_type="servicios",
            estimated_value=Decimal("60000"),
        ),
        RatingRow(
            "33333333-3333-4333-8333-333333333333",
            5,
            "subcontrata",
            title="Instalación de alumbrado exterior",
            cpv_codes=("45316100",),
            contract_type="obras",
            estimated_value=Decimal("500000"),
        ),
    ]
    own = [
        FavoriteRow(
            "11111111-1111-4111-8111-111111111111",
            "propia",
            title="Auditoría energética de alumbrado público",
            cpv_codes=("71314000",),
        ),
        FavoriteRow(
            "44444444-4444-4444-8444-444444444444",
            "propia",
            title="Mapa lumínico municipal",
            cpv_codes=("71314200",),
        ),
    ]
    return {
        "ratings": ratings,
        "own_favorites": own,
        "common_favorites": [],
        "peer_shares": [],
        "offer_cases": [
            OfferCaseRow(
                "55555555-5555-4555-8555-555555555555",
                "adjudicada",
                title="Dirección de obra alumbrado",
                cpv_codes=("71520000",),
            )
        ],
        "exclude_ids": {
            "11111111-1111-4111-8111-111111111111",
            "22222222-2222-4222-8222-222222222222",
            "33333333-3333-4333-8333-333333333333",
            "44444444-4444-4444-8444-444444444444",
        },
    }


def _fixture_candidates() -> list[CandidateTender]:
    return [
        CandidateTender(
            tender_id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            title="Auditoría de alumbrado público y telegestión",
            description="Eficiencia energética y mapa lumínico",
            cpv_codes=("71314000", "71314200"),
            contract_type="servicios",
            estimated_value=Decimal("55000"),
            text_rank=0.35,
            title_similarity=0.65,
        ),
        CandidateTender(
            tender_id="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            title="Limpieza viaria y recogida de residuos",
            cpv_codes=("90610000",),
            text_rank=0.0,
            title_similarity=0.05,
        ),
        CandidateTender(
            tender_id="cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            title="Instalación de equipo de alumbrado exterior LED",
            cpv_codes=("45316100",),
            contract_type="obras",
            estimated_value=Decimal("800000"),
            text_rank=0.25,
            title_similarity=0.4,
        ),
    ]


def _run_for_user_inputs(
    inputs: dict,
    candidates: list[CandidateTender],
) -> dict[str, list[Recommendation]]:
    out: dict[str, list[Recommendation]] = {}
    for profile in PROFILES:
        pos, neg = build_seeds_for_profile(
            profile,
            ratings=inputs["ratings"],
            own_favorites=inputs["own_favorites"],
            common_favorites=inputs["common_favorites"],
            peer_shares=inputs["peer_shares"],
            offer_cases=inputs["offer_cases"],
        )
        # Candidatas: excluir ya valoradas/favoritas propias
        excl = inputs.get("exclude_ids") or set()
        cands = [c for c in candidates if c.tender_id not in excl]
        ranked = rank_candidates(
            cands,
            profile=profile,
            positive_seeds=pos,
            negative_seeds=neg,
        )
        out[profile] = ranked
        _ = count_personal_seeds(pos)  # disponible para métricas
    return out


def run_recommendations(
    config: RecommendationsRunConfig | None = None,
) -> RecommendationsRunResult:
    cfg = config or RecommendationsRunConfig()
    result = RecommendationsRunResult(dry_run=cfg.dry_run)

    if cfg.dry_run:
        inputs = _fixture_inputs()
        ranked = _run_for_user_inputs(inputs, _fixture_candidates())
        merged = dedupe_recommendations_by_tender(ranked)
        result.users = 1
        result.written = len(merged)
        for rec in merged:
            key = rec.profile_kind or "tie"
            result.by_profile[key] = result.by_profile.get(key, 0) + 1
        return result

    with connect() as conn:
        user_ids = (
            [cfg.user_id] if cfg.user_id else list_user_ids(conn)
        )
        for uid in user_ids:
            inputs = load_user_seed_inputs(conn, uid)
            by_profile: dict[str, list] = {}
            for profile in PROFILES:
                pos, neg = build_seeds_for_profile(
                    profile,
                    ratings=inputs["ratings"],
                    own_favorites=inputs["own_favorites"],
                    common_favorites=inputs["common_favorites"],
                    peer_shares=inputs["peer_shares"],
                    offer_cases=inputs["offer_cases"],
                )
                prefs = seed_cpv_prefixes(pos)
                titles = [s.title for s in pos if s.title]
                candidates = load_candidates(
                    conn,
                    exclude_ids=inputs["exclude_ids"],
                    seed_cpv_prefixes=prefs,
                    seed_titles=titles,
                )
                by_profile[profile] = rank_candidates(
                    candidates,
                    profile=profile,
                    positive_seeds=pos,
                    negative_seeds=neg,
                )
            merged = dedupe_recommendations_by_tender(by_profile)
            n = replace_user_recommendations(
                conn, user_id=uid, rows=merged
            )
            for rec in merged:
                key = rec.profile_kind or "tie"
                result.by_profile[key] = result.by_profile.get(key, 0) + 1
            if n == 0 and count_personal_seeds(
                build_seeds_for_profile(
                    "propia",
                    ratings=inputs["ratings"],
                    own_favorites=inputs["own_favorites"],
                    common_favorites=[],
                    peer_shares=[],
                    offer_cases=[],
                )[0]
            ) < 3:
                result.skipped_cold += 1
            result.written += n
            result.users += 1
        conn.commit()
    return result
