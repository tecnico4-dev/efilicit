"""NUTS → CCAA y resolución de place_* (ADR 018)."""

from __future__ import annotations

from efilicit_ingestion.pipeline.geography import (
    nuts_to_ccaa_code,
    place_from_canonical_raw,
    resolve_place_fields,
)
from efilicit_ingestion.pipeline import stages
from efilicit_ingestion.models import SourceRecord
from datetime import datetime, timezone


def test_nuts2_and_nuts3_map_to_ccaa() -> None:
    assert nuts_to_ccaa_code("ES51") == "09"  # Cataluña
    assert nuts_to_ccaa_code("ES511") == "09"
    assert nuts_to_ccaa_code("ES21") == "16"  # País Vasco
    assert nuts_to_ccaa_code("ES213") == "16"
    assert nuts_to_ccaa_code("ES30") == "13"  # Madrid
    assert nuts_to_ccaa_code(None) is None
    assert nuts_to_ccaa_code("FR10") is None


def test_normalize_municipality_accepts_codi_ine10() -> None:
    from efilicit_ingestion.pipeline.geography import normalize_municipality_ine_code

    assert normalize_municipality_ine_code("0807710007") == "08077"
    assert normalize_municipality_ine_code("08019") == "08019"
    assert normalize_municipality_ine_code("8001763013") is None  # provincia inválida
    assert normalize_municipality_ine_code("UKI") is None


def test_resolve_place_derives_ccaa_from_municipality_when_no_nuts() -> None:
    place = resolve_place_fields(municipality_code="28079")
    assert place["place_municipality_code"] == "28079"
    assert place["place_ccaa_code"] == "13"  # Madrid vía provincia 28


def test_resolve_place_prefers_explicit_ccaa_and_municipality() -> None:
    place = resolve_place_fields(
        nuts_code="ES511",
        municipality_code="08019",
        ccaa_code="09",
    )
    assert place["place_nuts_code"] == "ES511"
    assert place["place_ccaa_code"] == "09"
    assert place["place_municipality_code"] == "08019"


def test_resolve_place_derives_ccaa_from_nuts_when_no_explicit() -> None:
    place = resolve_place_fields(nuts_code="es613")
    assert place["place_nuts_code"] == "ES613"
    assert place["place_ccaa_code"] == "01"  # Andalucía
    assert place["place_municipality_code"] is None


def test_normalize_attaches_place_from_nuts_codes() -> None:
    record = SourceRecord(
        source_record_id="geo-1",
        recorded_at=datetime(2026, 10, 1, tzinfo=timezone.utc),
        payload={
            "title": "Obra fixture",
            "status": "PUB",
            "contract_type": "3",
            "nuts_codes": ["ES213"],
            "authority": {"name": "Ayuntamiento Fixture"},
        },
    )
    out = stages.normalize([record])[0]
    canonical = out.payload["canonical"]
    assert canonical["place_nuts_code"] == "ES213"
    assert canonical["place_ccaa_code"] == "16"
    assert canonical["place_municipality_code"] is None


def test_place_from_raw_first_nuts() -> None:
    place = place_from_canonical_raw({"nuts_codes": ["ES30", "ES51"]})
    assert place["place_nuts_code"] == "ES30"
    assert place["place_ccaa_code"] == "13"
