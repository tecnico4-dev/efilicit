"""Semana 5 Paso 7.1: evaluador de criteria → tenders."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from efilicit_ingestion.alerts.criteria import SearchCriteria, parse_criteria
from efilicit_ingestion.alerts.match import evaluate_tender, match_alert_to_tenders
from efilicit_ingestion.alerts.models import AlertRule, TenderCandidate


def _tender(**overrides: object) -> TenderCandidate:
    base = dict(
        id="t-1",
        title="Mantenimiento de software en Madrid",
        description="Soporte de aplicaciones",
        status="publicada",
        procedure_type="open",
        contract_type="servicios",
        estimated_value=Decimal("50000"),
        cpv_codes=("72000000",),
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


def test_cpv_match_all_requires_every_prefix() -> None:
    multi = _tender(cpv_codes=("72000000", "30213000"))
    any_ok = parse_criteria(
        {"version": 1, "cpv_codes": ["72", "45"], "cpv_match": "any"}
    )
    assert evaluate_tender(any_ok, multi) is not None

    all_miss = parse_criteria(
        {"version": 1, "cpv_codes": ["72", "45"], "cpv_match": "all"}
    )
    assert evaluate_tender(all_miss, multi) is None

    all_hit = parse_criteria(
        {"version": 1, "cpv_codes": ["72", "302"], "cpv_match": "all"}
    )
    assert evaluate_tender(all_hit, multi) is not None


def test_value_range_and_geography() -> None:
    criteria = parse_criteria(
        {
            "version": 1,
            "estimated_value_min": 10_000,
            "estimated_value_max": 100_000,
            "geography": {"ccaa_codes": ["13"]},
        }
    )
    hit = evaluate_tender(criteria, _tender(place_ccaa_code="13"))
    assert hit is not None
    assert set(hit.reasons) == {"estimated_value", "geography"}


def test_geography_legacy_municipality_text() -> None:
    criteria = parse_criteria(
        {"version": 1, "geography": {"municipalities": ["Madrid"]}}
    )
    hit = evaluate_tender(criteria, _tender())
    assert hit is not None
    assert hit.reasons == ("geography",)


def test_open_for_submission_requires_future_deadline() -> None:
    criteria = parse_criteria({"version": 1, "open_for_submission": True})
    future = datetime.now(timezone.utc) + timedelta(days=7)
    past = datetime.now(timezone.utc) - timedelta(days=1)

    hit = evaluate_tender(criteria, _tender(deadline_at=future))
    assert hit is not None
    assert "deadline" in hit.reasons

    assert evaluate_tender(criteria, _tender(deadline_at=past)) is None
    assert evaluate_tender(criteria, _tender(deadline_at=None)) is None


def test_match_alert_to_tenders_filters_inactive_and_misses() -> None:
    software = _tender(id="t-soft")
    works = _tender(
        id="t-works",
        title="Obras de asfaltado",
        description="Calzada",
        cpv_codes=("45233140",),
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
