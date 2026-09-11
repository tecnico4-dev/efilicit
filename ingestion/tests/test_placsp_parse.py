"""Unit tests for PLACSP Atom/CODICE parse (Semana 2 Paso 5)."""

from __future__ import annotations

import zipfile
from io import BytesIO
from pathlib import Path

import pytest

from efilicit_ingestion.connectors.placsp import PlacspConnector
from efilicit_ingestion.connectors.placsp.parser import PlacspParseError, parse_placsp_artifact
from efilicit_ingestion.models import RemoteArtifact

FIXTURES = Path(__file__).parent / "fixtures" / "placsp"


def _artifact(name: str = "fixture.atom") -> RemoteArtifact:
    return RemoteArtifact(
        artifact_key=name,
        source_url="https://example.invalid/fixture",
        content_type="application/atom+xml",
    )


def _load(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


def test_parse_valid_entry_extracts_mvp_fields() -> None:
    records = list(parse_placsp_artifact(_load("valid_single_entry.atom"), _artifact()))
    assert len(records) == 1
    record = records[0]
    assert record.source_record_id == "B00000000:EXP/2026/0001"
    payload = record.payload
    assert payload["title"].startswith("Suministro de material")
    assert payload["status"] == "PUB"
    assert payload["contract_folder_id"] == "EXP/2026/0001"
    assert payload["estimated_value"] == "12500.50"
    assert payload["currency"] == "EUR"
    assert payload["cpv_codes"] == ["30192700"]
    assert payload["nuts_codes"] == ["ES300"]
    assert payload["contract_type"] == "1"
    assert payload["procedure_type"] == "1"
    assert payload["deadline_at"] == "2026-10-01T14:00:00"
    assert payload["authority"]["tax_id"] == "B00000000"
    assert payload["authority"]["name"] == "Organismo Fixture de Pruebas S.A."
    assert payload["publication_url"].endswith("FIX-VALID-001")
    assert record.recorded_at is not None


def test_parse_incomplete_entry_keeps_stable_id_without_tax_id() -> None:
    records = list(parse_placsp_artifact(_load("incomplete_entry.atom"), _artifact()))
    assert len(records) == 1
    record = records[0]
    assert record.source_record_id == "EXP/2026/INCOMP"
    assert record.payload["status"] is None
    assert record.payload["estimated_value"] is None
    assert record.payload["cpv_codes"] == []
    assert record.payload["authority"]["tax_id"] is None
    assert record.payload["authority"]["name"] == "Ayuntamiento Fixture Sin NIF"


def test_parse_unexpected_entry_without_identity_is_skipped() -> None:
    records = list(
        parse_placsp_artifact(_load("unexpected_no_identity.atom"), _artifact())
    )
    assert records == []


def test_parse_unexpected_malformed_xml_raises() -> None:
    with pytest.raises(PlacspParseError):
        list(parse_placsp_artifact(_load("unexpected_malformed.atom"), _artifact()))


def test_parse_zip_with_atom_member() -> None:
    buf = BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr(
            "licitacionesPerfilesContratanteCompleto3.atom",
            _load("valid_single_entry.atom"),
        )
    raw_zip = buf.getvalue()
    artifact = RemoteArtifact(
        artifact_key="licitacionesPerfilesContratanteCompleto3_202609.zip",
        source_url="https://example.invalid/202609.zip",
        content_type="application/zip",
    )
    records = list(parse_placsp_artifact(raw_zip, artifact))
    assert len(records) == 1
    assert records[0].source_record_id == "B00000000:EXP/2026/0001"
    assert records[0].payload["atom_member"].endswith(".atom")


def test_connector_parse_uses_parser() -> None:
    connector = PlacspConnector()
    records = list(
        connector.parse(_load("valid_single_entry.atom"), _artifact("valid.atom"))
    )
    assert len(records) == 1
    assert records[0].payload["artifact_key"] == "valid.atom"
