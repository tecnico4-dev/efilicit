"""Tests de scoring de recomendaciones (sin Postgres)."""

from __future__ import annotations

from decimal import Decimal

from efilicit_ingestion.recommendations.company_profile import (
    company_fit_score,
    cpv_company_fit,
)
from efilicit_ingestion.recommendations.models import CandidateTender, Seed
from efilicit_ingestion.recommendations.score import (
    SCORE_THRESHOLD,
    amount_band_score,
    cpv_prefix_score,
    rank_candidates,
    score_candidate,
)


def test_cpv_prefix_scale() -> None:
    assert cpv_prefix_score("71314000", "71314000") == 1.0
    assert cpv_prefix_score("71314999", "71314000") == 0.75
    assert cpv_prefix_score("7131", "71314000") >= 0.5
    assert cpv_prefix_score("99999999", "71314000") == 0.0


def test_personal_high_score_passes_threshold() -> None:
    seeds = [
        Seed(
            tender_id="s1",
            weight=1.0,
            source="rating",
            title="Auditoría alumbrado público LED",
            cpv_codes=("71314000",),
            contract_type="servicios",
            estimated_value=Decimal("50000"),
        )
    ]
    cand = CandidateTender(
        tender_id="c1",
        title="Auditoría energética de alumbrado público",
        cpv_codes=("71314000",),
        contract_type="servicios",
        estimated_value=Decimal("48000"),
        text_rank=0.4,
        title_similarity=0.7,
    )
    rec = score_candidate(
        cand, profile="propia", positive_seeds=seeds, negative_seeds=[]
    )
    assert rec is not None
    assert rec.score >= SCORE_THRESHOLD
    assert rec.reason["label"]


def test_weak_candidate_filtered_by_threshold() -> None:
    seeds = [
        Seed(
            tender_id="s1",
            weight=0.8,
            source="favorite",
            title="Alumbrado",
            cpv_codes=("71314000",),
        )
    ]
    cand = CandidateTender(
        tender_id="c1",
        title="Limpieza viaria municipal",
        cpv_codes=("90610000",),
        text_rank=0.0,
        title_similarity=0.05,
    )
    rec = score_candidate(
        cand, profile="propia", positive_seeds=seeds, negative_seeds=[]
    )
    assert rec is None


def test_company_entry_without_personal_seeds() -> None:
    cand = CandidateTender(
        tender_id="c1",
        title="Telegestión y plataforma de gestión de alumbrado público",
        description="Mapa lumínico e inventario",
        cpv_codes=("71314200", "72260000"),
        estimated_value=Decimal("80000"),
    )
    rec = score_candidate(
        cand, profile="propia", positive_seeds=[], negative_seeds=[]
    )
    assert rec is not None
    assert rec.reason.get("company_entry") or rec.reason["company"] >= 0.62


def test_negative_penalty_can_drop() -> None:
    seeds = [
        Seed(
            tender_id="s1",
            weight=1.0,
            source="rating",
            title="Proyecto alumbrado",
            cpv_codes=("71321000",),
        )
    ]
    neg = [
        Seed(
            tender_id="n1",
            weight=1.0,
            source="rating",
            title="Obra mala",
            cpv_codes=("71321000",),
        )
    ]
    cand = CandidateTender(
        tender_id="c1",
        title="Diseño técnico instalaciones",
        cpv_codes=("71321000",),
        text_rank=0.2,
        title_similarity=0.3,
    )
    without = score_candidate(
        cand, profile="propia", positive_seeds=seeds, negative_seeds=[]
    )
    with_neg = score_candidate(
        cand, profile="propia", positive_seeds=seeds, negative_seeds=neg
    )
    assert without is not None
    if with_neg is not None:
        assert with_neg.score < without.score


def test_amount_band() -> None:
    seeds = [
        Seed(
            "s1",
            1.0,
            "rating",
            estimated_value=Decimal("10000"),
        ),
        Seed(
            "s2",
            1.0,
            "rating",
            estimated_value=Decimal("50000"),
        ),
        Seed(
            "s3",
            1.0,
            "rating",
            estimated_value=Decimal("90000"),
        ),
    ]
    assert amount_band_score(Decimal("40000"), seeds) == 1.0
    assert amount_band_score(None, seeds) == 0.5


def test_rank_does_not_pad() -> None:
    seeds = [
        Seed(
            "s1",
            1.0,
            "rating",
            title="Alumbrado público LED",
            cpv_codes=("71314000",),
        )
    ]
    weak = [
        CandidateTender(
            tender_id=f"w{i}",
            title="Contrato generico sin relacion",
            cpv_codes=("03000000",),
        )
        for i in range(10)
    ]
    out = rank_candidates(
        weak, profile="propia", positive_seeds=seeds, negative_seeds=[]
    )
    assert out == []


def test_company_cpv_fit_propia_vs_sub() -> None:
    assert cpv_company_fit(["71314000"], profile="propia") >= 0.9
    mid = cpv_company_fit(["45316100"], profile="subcontrata")
    assert mid >= 0.7
    own_mid = cpv_company_fit(["45316100"], profile="propia")
    assert own_mid < mid


def test_company_fit_keywords() -> None:
    score, parts = company_fit_score(
        profile="propia",
        cpv_codes=("71314000",),
        title="Renovación LED alumbrado público con telegestión",
        estimated_value=Decimal("100000"),
    )
    assert score >= 0.6
    assert parts["keywords"] > 0
