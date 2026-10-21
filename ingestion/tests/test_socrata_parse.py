"""Socrata / Catalunya parse + normalize tests (Semana 3 Paso 7). No live network."""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path

import pytest

from efilicit_ingestion.connectors.socrata import SocrataConnector, SocrataParseError
from efilicit_ingestion.connectors.socrata.parser import (
    _CONTRACT_TYPE,
    _fold,
    parse_socrata_artifact,
)
from efilicit_ingestion.models import RemoteArtifact
from efilicit_ingestion.pipeline import stages

FIXTURE = Path(__file__).parent / "fixtures" / "catalunya" / "valid_page.json"


def _artifact() -> RemoteArtifact:
    return RemoteArtifact(
        artifact_key="ybgg-dgi6_offset_0000000_limit_1000.json",
        source_url=(
            "https://analisi.transparenciacatalunya.cat/resource/"
            "ybgg-dgi6.json?$limit=1000&$offset=0"
        ),
        content_type="application/json",
        metadata={"dataset_id": "ybgg-dgi6"},
    )


def test_catalunya_parse_maps_rows_and_skips_without_id() -> None:
    records = list(parse_socrata_artifact(FIXTURE.read_bytes(), _artifact()))
    assert len(records) == 2
    assert records[0].source_record_id == "aaaaaaaa-bbbb-cccc-dddd-000000000001"
    assert records[0].payload["title"].startswith("Suministro")
    assert records[0].payload["status"] == "PUB"
    assert records[0].payload["contract_type"] == "1"
    assert records[0].payload["procedure_type"] == "1"
    assert records[0].payload["procedure_label"] == "Obert"
    assert records[0].payload["estimated_value"] == "12500.50"
    assert records[0].payload["cpv_codes"] == ["30192700"]
    assert records[0].payload["municipality_ine_code"] == "0807710007"
    assert records[0].payload["authority"]["platform_id"] == "L01000001"
    assert records[1].source_record_id == "aaaaaaaa-bbbb-cccc-dddd-000000000002"
    assert records[1].payload["status"] == "ADJ"
    assert records[1].payload["contract_type"] == "2"


def test_catalunya_concession_labels_map_to_codice_not_obres_serveis() -> None:
    """Concesiones no deben aplanarse a obras(3)/servicios(2)."""
    assert _CONTRACT_TYPE[_fold("Concessió d'obres")] == "32"
    assert _CONTRACT_TYPE[_fold("Concessió de serveis")] == "22"
    assert _CONTRACT_TYPE[_fold("Concessió d'obres públiques")] == "31"
    assert _CONTRACT_TYPE[_fold("Gestió de serveis públics")] == "21"

    raw = (
        b'[{"id_intern":"cccccccc-dddd-eeee-ffff-000000000099",'
        b'"nom_organ":"Ajuntament Fixture",'
        b'"tipus_contracte":"Concessi\\u00f3 de serveis",'
        b'"denominacio":"Concessio fixture"}]'
    )
    records = list(parse_socrata_artifact(raw, _artifact()))
    assert len(records) == 1
    assert records[0].payload["contract_type"] == "22"
    canonical = stages.normalize(records)[0].payload["canonical"]
    assert canonical["contract_type"] == "concesion_servicios"


def test_catalunya_parse_malformed_raises() -> None:
    with pytest.raises(SocrataParseError):
        list(parse_socrata_artifact(b"not-json", _artifact()))


def test_catalunya_connector_parse_normalize_identity() -> None:
    connector = SocrataConnector()
    records = list(connector.parse(FIXTURE.read_bytes(), _artifact()))
    identified = stages.resolve_identity(stages.normalize(records))

    assert connector.source_code == "catalunya"
    assert len(identified) == 2
    first = identified[0].payload["canonical"]
    assert first["title"].startswith("Suministro")
    assert first["status"] == "publicada"
    assert first["contract_type"] == "suministros"
    assert first["procedure_type"] == "abierto"
    assert first["estimated_value"] == Decimal("12500.50")
    assert first["cpv_codes"] == ["30192700"]
    assert first["nuts_code"] == "ES511"
    assert first["place_nuts_code"] == "ES511"
    assert first["place_ccaa_code"] == "09"
    assert first["place_municipality_code"] == "08077"
    assert first["authority"]["platform_id"] == "L01000001"
    assert first["authority"]["identity_confidence"] == "MEDIUM"
    assert first["source_url"].startswith("https://example.invalid/")
