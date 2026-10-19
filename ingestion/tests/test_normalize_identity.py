"""Tests Semana 2 Paso 6: normalize + identidad de organismo."""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path

from efilicit_ingestion.connectors.placsp.parser import parse_placsp_artifact
from efilicit_ingestion.models import RemoteArtifact, SourceRecord
from efilicit_ingestion.pipeline import stages
from efilicit_ingestion.pipeline.canonical import normalize_name

FIXTURES = Path(__file__).parent / "fixtures" / "placsp"


def _parse_fixture(name: str) -> list[SourceRecord]:
    raw = (FIXTURES / name).read_bytes()
    artifact = RemoteArtifact(
        artifact_key=name,
        source_url="https://example.invalid/fixture",
        content_type="application/atom+xml",
    )
    return list(parse_placsp_artifact(raw, artifact))


def test_normalize_valid_fixture_maps_mvp_fields() -> None:
    records = _parse_fixture("valid_single_entry.atom")
    normalized = stages.normalize(records)
    identified = stages.resolve_identity(normalized)

    assert len(identified) == 1
    canonical = identified[0].payload["canonical"]
    assert canonical["title"].startswith("Suministro de material")
    assert canonical["status"] == "publicada"
    assert canonical["status_code"] == "PUB"
    assert canonical["contract_type"] == "suministros"
    assert canonical["procedure_type"] == "abierto"
    assert canonical["estimated_value"] == Decimal("12500.50")
    assert canonical["currency"] == "EUR"
    assert canonical["cpv_code"] == "30192700"
    assert canonical["nuts_code"] == "ES300"
    assert canonical["publication_date"].isoformat() == "2026-09-10"
    assert canonical["deadline_at"].isoformat().startswith("2026-10-01T14:00:00")
    assert canonical["source_tender_id"] == "B00000000:EXP/2026/0001"
    assert canonical["authority"]["tax_id"] == "B00000000"
    assert canonical["authority"]["name_normalized"] == (
        "organismo fixture de pruebas s.a."
    )
    assert canonical["authority"]["identity_confidence"] == "HIGH"


def test_normalize_incomplete_fixture_identity_is_low_without_tax_id() -> None:
    records = _parse_fixture("incomplete_entry.atom")
    identified = stages.resolve_identity(stages.normalize(records))
    canonical = identified[0].payload["canonical"]

    assert canonical["status"] is None
    assert canonical["estimated_value"] is None
    assert canonical["cpv_code"] is None
    assert canonical["authority"]["tax_id"] is None
    assert canonical["authority"]["identity_confidence"] == "LOW"
    assert "ayuntamiento fixture sin nif" in canonical["authority"]["name_normalized"]


def test_resolve_identity_medium_with_platform_id_only() -> None:
    record = SourceRecord(
        source_record_id="plat:EXP-1",
        payload={
            "title": "Test",
            "authority": {"name": "Org", "tax_id": None, "platform_id": "123"},
            "cpv_codes": [],
            "nuts_codes": [],
        },
    )
    identified = stages.resolve_identity(stages.normalize([record]))
    assert (
        identified[0].payload["canonical"]["authority"]["identity_confidence"]
        == "MEDIUM"
    )


def test_normalize_name_strips_accents_and_case() -> None:
    assert normalize_name("  Ayuntamiento de Málaga  ") == "ayuntamiento de malaga"


def test_normalize_cpv_pads_to_8_and_keeps_check_digit() -> None:
    from efilicit_ingestion.pipeline.canonical import normalize_cpv_code

    assert normalize_cpv_code("31640000") == "31640000"
    assert normalize_cpv_code("316400") == "31640000"
    assert normalize_cpv_code("31") == "31000000"
    assert normalize_cpv_code("31640000-4") == "31640000-4"
    assert normalize_cpv_code("3019.2700") == "30192700"
    assert normalize_cpv_code("N/A") is None

    record = SourceRecord(
        source_record_id="cpv-ok",
        payload={
            "title": "Test",
            "authority": {"name": "Org"},
            "cpv_codes": ["316400-4"],
            "nuts_codes": [],
        },
    )
    assert stages.normalize([record])[0].payload["canonical"]["cpv_code"] == (
        "31640000-4"
    )


def test_normalize_procedure_code_9_is_abierto_simplificado() -> None:
    record = SourceRecord(
        source_record_id="proc-9",
        payload={
            "title": "Test abierto simplificado",
            "procedure_type": "9",
            "authority": {"name": "Org", "tax_id": "B00000000"},
            "cpv_codes": [],
            "nuts_codes": [],
        },
    )
    canonical = stages.normalize([record])[0].payload["canonical"]
    assert canonical["procedure_type"] == "abierto_simplificado"
    assert canonical["procedure_code"] == "9"
