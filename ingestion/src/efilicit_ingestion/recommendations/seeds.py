"""Construcción de semillas por perfil (ADR 034)."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from efilicit_ingestion.recommendations.models import ProfileKind, Seed, SeedSource

# Pesos
WEIGHT_STAR_5 = 1.0
WEIGHT_STAR_4 = 0.8
WEIGHT_FAVORITE_ALONE = 0.8
WEIGHT_FAVORITE_BONUS = 0.1
WEIGHT_COMMON = 0.45
WEIGHT_PEER = 0.40
WEIGHT_OFFER_ADJUDICADA = 0.85
WEIGHT_OFFER_ACTIVE = 0.55
WEIGHT_OFFER_HIST = 0.50

MIN_PERSONAL_SEEDS = 3


@dataclass(frozen=True, slots=True)
class RatingRow:
    tender_id: str
    score: int
    interest_kind: str | None
    title: str = ""
    cpv_codes: tuple[str, ...] = ()
    contract_type: str | None = None
    estimated_value: Decimal | None = None


@dataclass(frozen=True, slots=True)
class FavoriteRow:
    tender_id: str
    kind: str
    title: str = ""
    cpv_codes: tuple[str, ...] = ()
    contract_type: str | None = None
    estimated_value: Decimal | None = None


@dataclass(frozen=True, slots=True)
class OfferCaseRow:
    tender_id: str
    stage: str
    kind: ProfileKind = "propia"
    title: str = ""
    cpv_codes: tuple[str, ...] = ()
    contract_type: str | None = None
    estimated_value: Decimal | None = None


def _meta(
    title: str,
    cpv_codes: tuple[str, ...],
    contract_type: str | None,
    estimated_value: Decimal | None,
) -> dict:
    return {
        "title": title,
        "cpv_codes": cpv_codes,
        "contract_type": contract_type,
        "estimated_value": estimated_value,
    }


def _offer_profile(kind: str) -> ProfileKind:
    return "subcontrata" if kind == "subcontrata" else "propia"


def _offer_weight(stage: str) -> float:
    if stage == "adjudicada":
        return WEIGHT_OFFER_ADJUDICADA
    if stage in {
        "interes",
        "analisis",
        "preparacion",
        "presentada",
        "requerimiento",
    }:
        return WEIGHT_OFFER_ACTIVE
    if stage == "no_adjudicada":
        return WEIGHT_OFFER_HIST
    # descartada: no semilla positiva
    return 0.0


def build_seeds_for_profile(
    profile: ProfileKind,
    *,
    ratings: list[RatingRow],
    own_favorites: list[FavoriteRow],
    common_favorites: list[FavoriteRow],
    peer_shares: list[FavoriteRow],
    offer_cases: list[OfferCaseRow],
) -> tuple[list[Seed], list[Seed]]:
    """Devuelve (positivas, negativas) para el perfil.

    Dedupe por tender_id: se queda el mayor peso (con bonus favorito+nota).
    """
    positive: dict[str, Seed] = {}
    negative: list[Seed] = []

    def upsert(seed: Seed) -> None:
        prev = positive.get(seed.tender_id)
        if prev is None or seed.weight > prev.weight:
            positive[seed.tender_id] = seed
        elif prev is not None and seed.weight == prev.weight:
            # Preferir fuente personal sobre equipo
            rank = {
                "rating": 0,
                "favorite": 1,
                "offer_case": 2,
                "common": 3,
                "peer_share": 4,
            }
            if rank.get(seed.source, 9) < rank.get(prev.source, 9):
                positive[seed.tender_id] = seed

    # Ratings
    for r in ratings:
        if r.interest_kind != profile:
            continue
        meta = _meta(r.title, r.cpv_codes, r.contract_type, r.estimated_value)
        if r.score in (1, 2):
            negative.append(
                Seed(
                    tender_id=r.tender_id,
                    weight=1.0 if r.score == 1 else 0.7,
                    source="rating",
                    **meta,
                )
            )
            continue
        if r.score == 3 or r.score not in (4, 5):
            continue
        w = WEIGHT_STAR_5 if r.score == 5 else WEIGHT_STAR_4
        upsert(
            Seed(
                tender_id=r.tender_id,
                weight=w,
                source="rating",
                **meta,
            )
        )

    # Favoritos propios: bonus si ya hay rating
    own_ids = {f.tender_id for f in own_favorites if f.kind == profile}
    for f in own_favorites:
        if f.kind != profile:
            continue
        meta = _meta(f.title, f.cpv_codes, f.contract_type, f.estimated_value)
        prev = positive.get(f.tender_id)
        if prev and prev.source == "rating":
            upsert(
                Seed(
                    tender_id=f.tender_id,
                    weight=min(1.0, prev.weight + WEIGHT_FAVORITE_BONUS),
                    source="rating",
                    title=prev.title or f.title,
                    cpv_codes=prev.cpv_codes or f.cpv_codes,
                    contract_type=prev.contract_type or f.contract_type,
                    estimated_value=prev.estimated_value
                    if prev.estimated_value is not None
                    else f.estimated_value,
                )
            )
        else:
            upsert(
                Seed(
                    tender_id=f.tender_id,
                    weight=WEIGHT_FAVORITE_ALONE,
                    source="favorite",
                    **meta,
                )
            )

    # Común / peer (mismo kind)
    for f in common_favorites:
        if f.kind != profile:
            continue
        if f.tender_id in own_ids:
            continue
        meta = _meta(f.title, f.cpv_codes, f.contract_type, f.estimated_value)
        upsert(
            Seed(
                tender_id=f.tender_id,
                weight=WEIGHT_COMMON,
                source="common",
                **meta,
            )
        )

    for f in peer_shares:
        if f.kind != profile:
            continue
        if f.tender_id in own_ids:
            continue
        meta = _meta(f.title, f.cpv_codes, f.contract_type, f.estimated_value)
        upsert(
            Seed(
                tender_id=f.tender_id,
                weight=WEIGHT_PEER,
                source="peer_share",
                **meta,
            )
        )

    # Offer cases → perfil según kind (propia | subcontrata)
    for o in offer_cases:
        if _offer_profile(o.kind) != profile:
            continue
        w = _offer_weight(o.stage)
        if w <= 0:
            continue
        meta = _meta(o.title, o.cpv_codes, o.contract_type, o.estimated_value)
        upsert(
            Seed(
                tender_id=o.tender_id,
                weight=w,
                source="offer_case",
                **meta,
            )
        )

    return list(positive.values()), negative


def count_personal_seeds(seeds: list[Seed]) -> int:
    return sum(1 for s in seeds if s.source in ("rating", "favorite"))
