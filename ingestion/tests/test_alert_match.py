"""Semana 5 Paso 7.1: evaluador de criteria → tenders."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from efilicit_ingestion.alerts.criteria import SearchCriteria, parse_criteria
from efilicit_ingestion.alerts.match import evaluate_tender, match_alert_to_tenders
from efilicit_ingestion.alerts.models import AlertRule, TenderCandidate


def _tender(**overrides: object) -> TenderCandidate:
    base = dict(
        id="t-1",
        title="Mantenimiento de software en Madrid",
        description="Soporte de aplicaciones",
        status="published",
        procedure_type="open",
        contract_type="services",
        estimated_value=Decimal("50000"),
        cpv_code="72000000",
        publication_date=date(2026, 9, 1),
        authority_id="auth-1",
        authority_tax_id="P2807900B",
        authority_name="Ayuntamiento de Madrid",
        authority_name_normalized="ayuntamiento de madrid",
        municipality="Madrid",
        country="ES",
    )
    base.update(overrides)
    return TenderCandidate(**base)  # type: ignore[arg-type]


def test_empty_criteria_does_not_match() -> None:
    criteria = SearchCriteria(version=1)
    assert criteria.has_filters() is False
    assert evaluate_tender(criteria, _tender()) is None


def test_keywords_and_cpv_match() -> None:
    criteria = parse_criteria(
        {
            "version": 1,
            "keywords": ["software"],
            "cpv_codes": ["72000000"],
        }
    )
    hit = evaluate_tender(criteria, _tender())
    assert hit is not None
    assert hit.tender_id == "t-1"
    assert "keywords" in hit.reasons
    assert "cpv_codes" in hit.reasons
    assert hit.score == 1.0
    assert hit.priority == "high"


def test_no_match_when_cpv_differs() -> None:
    criteria = parse_criteria(
        {
            "version": 1,
            "keywords": ["software"],
            "cpv_codes": ["45000000"],
        }
    )
    assert evaluate_tender(criteria, _tender()) is None


def test_value_range_and_geography() -> None:
    criteria = parse_criteria(
        {
            "version": 1,
            "estimated_value_min": 10_000,
            "estimated_value_max": 100_000,
            "geography": {"municipalities": ["Madrid"]},
        }
    )
    hit = evaluate_tender(criteria, _tender())
    assert hit is not None
    assert set(hit.reasons) == {"estimated_value", "geography"}


def test_match_alert_to_tenders_filters_inactive_and_misses() -> None:
    software = _tender(id="t-soft")
    works = _tender(
        id="t-works",
        title="Obras de asfaltado",
        description="Calzada",
        cpv_code="45233140",
        estimated_value=Decimal("200000"),
    )
    alert = AlertRule(
        id="a-1",
        user_id="u-1",
        name="Soft",
        criteria={"version": 1, "keywords": ["software"], "cpv_codes": ["72"]},
        is_active=True,
    )
    matches = match_alert_to_tenders(alert, [software, works])
    assert [m.tender_id for m in matches] == ["t-soft"]

    inactive = AlertRule(
        id="a-2",
        user_id="u-1",
        name="Off",
        criteria={"version": 1, "keywords": ["software"]},
        is_active=False,
    )
    assert match_alert_to_tenders(inactive, [software]) == []
