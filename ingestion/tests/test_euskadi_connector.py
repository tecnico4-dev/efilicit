"""Euskadi discover / fetch / parse tests (Semana 3 Paso 9). No live network."""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path

import pytest

from efilicit_ingestion.connectors import EuskadiConnector, SourceConnector
from efilicit_ingestion.connectors.euskadi import EUSKADI, EuskadiHttpError, EuskadiParseError
from efilicit_ingestion.connectors.euskadi.parser import (
    _CONTRACT_TYPE,
    _fold,
    parse_euskadi_artifact,
)
from efilicit_ingestion.models import RemoteArtifact, SyncContext
from efilicit_ingestion.pipeline import stages

FIXTURE = Path(__file__).parent / "fixtures" / "euskadi" / "valid_page.json"


def _artifact() -> RemoteArtifact:
    return RemoteArtifact(
        artifact_key="contracting-notices_page_000001.json",
        source_url="https://api.euskadi.eus/procurements/contracting-notices?currentPage=1",
        content_type="application/json",
    )


def test_euskadi_connector_is_source_connector() -> None:
    connector = EuskadiConnector(max_pages=1)
    assert isinstance(connector, SourceConnector)
    assert connector.source_code == "euskadi"
    assert connector.dataset == EUSKADI


def test_euskadi_discover_builds_stable_page_artifacts() -> None:
    connector = EuskadiConnector(max_pages=2, start_page=1)
    arts = connector.discover(SyncContext(source_code="euskadi", run_id="d1"))
    assert len(arts) == 2
    assert arts[0].artifact_key == "contracting-notices_page_000001.json"
    assert arts[1].artifact_key == "contracting-notices_page_000002.json"
    assert "currentPage=1" in (arts[0].source_url or "")
    assert "currentPage=2" in (arts[1].source_url or "")


def test_euskadi_discover_respects_cursor() -> None:
    connector = EuskadiConnector(max_pages=2, start_page=1)
    arts = connector.discover(
        SyncContext(
            source_code="euskadi",
            run_id="d2",
            cursor="contracting-notices_page_000001.json",
        )
    )
    assert len(arts) == 1
    assert arts[0].artifact_key == "contracting-notices_page_000002.json"


def test_euskadi_fetch_uses_transport() -> None:
    body = FIXTURE.read_bytes()

    def transport(url: str) -> tuple[int, dict[str, str], bytes]:
        assert "contracting-notices" in url
        return 200, {"content-type": "application/json"}, body

    connector = EuskadiConnector(fetch_transport=transport)
    art = connector.discover(SyncContext(source_code="euskadi", run_id="f1"))[0]
    assert connector.fetch(art) == body


def test_euskadi_fetch_http_error() -> None:
    connector = EuskadiConnector(
        fetch_transport=lambda _u: (503, {}, b"unavailable"),
    )
    art = connector.discover(SyncContext(source_code="euskadi", run_id="f2"))[0]
    with pytest.raises(EuskadiHttpError):
        connector.fetch(art)


def test_euskadi_parse_maps_and_skips_without_id() -> None:
    records = list(parse_euskadi_artifact(FIXTURE.read_bytes(), _artifact()))
    assert len(records) == 2
    assert records[0].source_record_id == "900001"
    assert records[0].payload["status"] == "PUB"
    assert records[0].payload["contract_type"] == "1"
    assert records[0].payload["procedure_type"] == "1"
    assert records[0].payload["procedure_label"] == "Abierto"
    assert records[0].payload["authority"]["tax_id"] == "S4833001C"
    assert records[0].payload["deadline_at"] == "2026-10-15T12:00:00"
    assert records[0].payload["cpv_codes"] == []
    assert records[1].source_record_id == "900002"
    assert records[1].payload["status"] == "ADJ"
    assert records[1].payload["authority"]["tax_id"] is None
    assert records[1].payload["deadline_at"] is None


def test_euskadi_concession_labels_and_codice_ids() -> None:
    assert _CONTRACT_TYPE[_fold("Concesión de servicios")] == "22"
    assert _CONTRACT_TYPE[_fold("Concesión de obras")] == "32"
    assert _CONTRACT_TYPE[_fold("Gestión de servicios públicos")] == "21"

    raw = b"""{
      "totalItems": 1,
      "items": [{
        "id": 900099,
        "code": "EXP/CONC",
        "object": "Concesion fixture",
        "contractingAuthority": {"name": "Org Fixture"},
        "contractType": {"id": 22, "name": "Concesion de servicios"},
        "contractProcedureStatus": {"name": "Publicacion"}
      }]
    }"""
    records = list(parse_euskadi_artifact(raw, _artifact()))
    assert len(records) == 1
    assert records[0].payload["contract_type"] == "22"
    canonical = stages.normalize(records)[0].payload["canonical"]
    assert canonical["contract_type"] == "concesion_servicios"


def test_euskadi_parse_malformed_raises() -> None:
    with pytest.raises(EuskadiParseError):
        list(parse_euskadi_artifact(b"not-json", _artifact()))


def test_euskadi_parse_normalize_identity() -> None:
    connector = EuskadiConnector()
    records = list(connector.parse(FIXTURE.read_bytes(), _artifact()))
    identified = stages.resolve_identity(stages.normalize(records))
    first = identified[0].payload["canonical"]
    assert first["title"].startswith("Suministro")
    assert first["status"] == "publicada"
    assert first["contract_type"] == "suministros"
    assert first["procedure_type"] == "abierto"
    assert first["estimated_value"] == Decimal("12500.5")
    assert first["deadline_at"] is not None
    # Fixture naive 12:00 Madrid (CEST) → 10:00 UTC
    assert first["deadline_at"].isoformat().startswith("2026-10-15T10:00:00")
    assert first["cpv_codes"] == []
    assert first["authority"]["tax_id"] == "S4833001C"
    assert first["authority"]["identity_confidence"] == "HIGH"
    second = identified[1].payload["canonical"]
    assert second["authority"]["identity_confidence"] == "MEDIUM"
    assert second["deadline_at"] is None
