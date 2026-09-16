"""Socrata / Catalunya discover tests (Semana 3 Paso 7). No live network."""

from __future__ import annotations

from efilicit_ingestion.connectors import SourceConnector, SocrataConnector
from efilicit_ingestion.connectors.socrata import CATALUNYA
from efilicit_ingestion.models import SyncContext


def test_socrata_connector_is_source_connector() -> None:
    connector = SocrataConnector(max_pages=1, page_size=100)
    assert isinstance(connector, SourceConnector)
    assert connector.source_code == "catalunya"
    assert connector.dataset == CATALUNYA


def test_catalunya_discover_builds_stable_page_artifacts() -> None:
    connector = SocrataConnector(page_size=500, max_pages=2, start_offset=0)
    context = SyncContext(source_code="catalunya", run_id="discover-cat-1")

    artifacts = connector.discover(context)
    assert len(artifacts) == 2

    first, second = artifacts
    assert first.artifact_key == "ybgg-dgi6_offset_0000000_limit_0500.json"
    assert second.artifact_key == "ybgg-dgi6_offset_0000500_limit_0500.json"
    assert first.content_type == "application/json"
    assert "ybgg-dgi6.json" in (first.source_url or "")
    assert "$limit=500" in (first.source_url or "")
    assert "$offset=0" in (first.source_url or "")
    assert first.metadata["dataset_id"] == "ybgg-dgi6"
    assert second.metadata["offset"] == 500


def test_catalunya_discover_respects_cursor() -> None:
    connector = SocrataConnector(page_size=100, max_pages=2)
    cursor = "ybgg-dgi6_offset_0000000_limit_0100.json"
    context = SyncContext(
        source_code="catalunya",
        run_id="discover-cat-cursor",
        cursor=cursor,
    )
    artifacts = connector.discover(context)
    assert len(artifacts) == 1
    assert artifacts[0].artifact_key == "ybgg-dgi6_offset_0000100_limit_0100.json"
