"""Parse tests for placsp_agregadas (Semana 3 Paso 4.2).

Reuses Semana 2 Atom/CODICE fixtures: same family/format, different
source_code / ZIP member naming (PlataformasAgregadasSinMenores).
No live network.
"""

from __future__ import annotations

import zipfile
from io import BytesIO
from pathlib import Path

import pytest

from efilicit_ingestion.connectors.placsp import PLACSP_AGREGADAS, PlacspConnector
from efilicit_ingestion.connectors.placsp.parser import PlacspParseError, parse_placsp_artifact
from efilicit_ingestion.models import RemoteArtifact

# Same CODICE fixtures as perfiles; agregadas share the Atom/CODICE shape.
FIXTURES = Path(__file__).parent / "fixtures" / "placsp"


def _load(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


def _agregadas_atom_artifact(name: str = "PlataformasAgregadasSinMenores.atom") -> RemoteArtifact:
    return RemoteArtifact(
        artifact_key=name,
        source_url=(
            "https://contrataciondelsectorpublico.gob.es/sindicacion/"
            "sindicacion_1044/PlataformasAgregadasSinMenores.atom"
        ),
        content_type="application/atom+xml",
        metadata={"sindicacion": "1044", "feed_base": "PlataformasAgregadasSinMenores"},
    )


def _agregadas_zip_artifact() -> RemoteArtifact:
    return RemoteArtifact(
        artifact_key="PlataformasAgregadasSinMenores_202609.zip",
        source_url=(
            "https://contrataciondelsectorpublico.gob.es/sindicacion/"
            "sindicacion_1044/PlataformasAgregadasSinMenores_202609.zip"
        ),
        content_type="application/zip",
        metadata={"sindicacion": "1044", "package_kind": "monthly"},
    )


def test_agregadas_parse_valid_entry_extracts_mvp_fields() -> None:
    records = list(
        parse_placsp_artifact(
            _load("valid_single_entry.atom"),
            _agregadas_atom_artifact(),
        )
    )
    assert len(records) == 1
    record = records[0]
    assert record.source_record_id == "B00000000:EXP/2026/0001"
    payload = record.payload
    assert payload["title"].startswith("Suministro de material")
    assert payload["contract_folder_id"] == "EXP/2026/0001"
    assert payload["authority"]["tax_id"] == "B00000000"
    assert payload["artifact_key"] == "PlataformasAgregadasSinMenores.atom"


def test_agregadas_parse_incomplete_and_skip_no_identity() -> None:
    incomplete = list(
        parse_placsp_artifact(
            _load("incomplete_entry.atom"),
            _agregadas_atom_artifact("incomplete.atom"),
        )
    )
    assert len(incomplete) == 1
    assert incomplete[0].source_record_id == "EXP/2026/INCOMP"

    skipped = list(
        parse_placsp_artifact(
            _load("unexpected_no_identity.atom"),
            _agregadas_atom_artifact("no-id.atom"),
        )
    )
    assert skipped == []


def test_agregadas_parse_malformed_raises() -> None:
    with pytest.raises(PlacspParseError):
        list(
            parse_placsp_artifact(
                _load("unexpected_malformed.atom"),
                _agregadas_atom_artifact("bad.atom"),
            )
        )


def test_agregadas_parse_zip_with_official_atom_member_name() -> None:
    """ZIP member name matches docs/sources/placsp_agregadas.md."""
    buf = BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr(
            "PlataformasAgregadasSinMenores.atom",
            _load("valid_single_entry.atom"),
        )
    records = list(parse_placsp_artifact(buf.getvalue(), _agregadas_zip_artifact()))
    assert len(records) == 1
    assert records[0].source_record_id == "B00000000:EXP/2026/0001"
    assert records[0].payload["atom_member"] == "PlataformasAgregadasSinMenores.atom"
    assert records[0].payload["artifact_key"] == (
        "PlataformasAgregadasSinMenores_202609.zip"
    )


def test_agregadas_connector_parse_reuses_parser() -> None:
    connector = PlacspConnector(syndication=PLACSP_AGREGADAS)
    assert connector.source_code == "placsp_agregadas"
    records = list(
        connector.parse(
            _load("valid_single_entry.atom"),
            _agregadas_atom_artifact(),
        )
    )
    assert len(records) == 1
    assert records[0].payload["title"].startswith("Suministro de material")
