"""Parse tests for placsp_menores (Semana 4 Paso 2.3).

Reuses Semana 2 Atom/CODICE fixtures: same family/format, different
source_code / ZIP member naming (contratosMenoresPerfilesContratantes).
No live network.
"""

from __future__ import annotations

import zipfile
from io import BytesIO
from pathlib import Path

import pytest

from efilicit_ingestion.connectors.placsp import PLACSP_MENORES, PlacspConnector
from efilicit_ingestion.connectors.placsp.parser import PlacspParseError, parse_placsp_artifact
from efilicit_ingestion.models import RemoteArtifact

FIXTURES = Path(__file__).parent / "fixtures" / "placsp"


def _load(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


def _menores_atom_artifact(
    name: str = "contratosMenoresPerfilesContratantes.atom",
) -> RemoteArtifact:
    return RemoteArtifact(
        artifact_key=name,
        source_url=(
            "https://contrataciondelsectorpublico.gob.es/sindicacion/"
            "sindicacion_1143/contratosMenoresPerfilesContratantes.atom"
        ),
        content_type="application/atom+xml",
        metadata={
            "sindicacion": "1143",
            "feed_base": "contratosMenoresPerfilesContratantes",
        },
    )


def _menores_zip_artifact() -> RemoteArtifact:
    return RemoteArtifact(
        artifact_key="contratosMenoresPerfilesContratantes_202609.zip",
        source_url=(
            "https://contrataciondelsectorpublico.gob.es/sindicacion/"
            "sindicacion_1143/contratosMenoresPerfilesContratantes_202609.zip"
        ),
        content_type="application/zip",
        metadata={"sindicacion": "1143", "package_kind": "monthly"},
    )


def test_menores_parse_valid_entry_extracts_mvp_fields() -> None:
    records = list(
        parse_placsp_artifact(
            _load("valid_single_entry.atom"),
            _menores_atom_artifact(),
        )
    )
    assert len(records) == 1
    record = records[0]
    assert record.source_record_id == "B00000000:EXP/2026/0001"
    payload = record.payload
    assert payload["title"].startswith("Suministro de material")
    assert payload["contract_folder_id"] == "EXP/2026/0001"
    assert payload["authority"]["tax_id"] == "B00000000"
    assert payload["artifact_key"] == "contratosMenoresPerfilesContratantes.atom"


def test_menores_parse_incomplete_and_skip_no_identity() -> None:
    incomplete = list(
        parse_placsp_artifact(
            _load("incomplete_entry.atom"),
            _menores_atom_artifact("incomplete.atom"),
        )
    )
    assert len(incomplete) == 1
    assert incomplete[0].source_record_id == "EXP/2026/INCOMP"

    skipped = list(
        parse_placsp_artifact(
            _load("unexpected_no_identity.atom"),
            _menores_atom_artifact("no-id.atom"),
        )
    )
    assert skipped == []


def test_menores_parse_malformed_raises() -> None:
    with pytest.raises(PlacspParseError):
        list(
            parse_placsp_artifact(
                _load("unexpected_malformed.atom"),
                _menores_atom_artifact("bad.atom"),
            )
        )


def test_menores_parse_zip_with_official_atom_member_name() -> None:
    """ZIP member name matches docs/sources/placsp_menores.md."""
    buf = BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr(
            "contratosMenoresPerfilesContratantes.atom",
            _load("valid_single_entry.atom"),
        )
    records = list(parse_placsp_artifact(buf.getvalue(), _menores_zip_artifact()))
    assert len(records) == 1
    assert records[0].source_record_id == "B00000000:EXP/2026/0001"
    assert records[0].payload["atom_member"] == (
        "contratosMenoresPerfilesContratantes.atom"
    )
    assert records[0].payload["artifact_key"] == (
        "contratosMenoresPerfilesContratantes_202609.zip"
    )


def test_menores_connector_parse_reuses_parser() -> None:
    connector = PlacspConnector(syndication=PLACSP_MENORES)
    assert connector.source_code == "placsp_menores"
    records = list(
        connector.parse(
            _load("valid_single_entry.atom"),
            _menores_atom_artifact(),
        )
    )
    assert len(records) == 1
    assert records[0].payload["title"].startswith("Suministro de material")
