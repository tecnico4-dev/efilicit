"""Socrata / Catalunya discover tests (Semana 3 + ADR 025). No live network."""

from __future__ import annotations

from datetime import datetime
from urllib.parse import unquote
from zoneinfo import ZoneInfo

from efilicit_ingestion.connectors import SourceConnector, SocrataConnector
from efilicit_ingestion.connectors.socrata import CATALUNYA
from efilicit_ingestion.connectors.socrata.connector import madrid_since_iso
from efilicit_ingestion.models import SyncContext


def test_socrata_connector_is_source_connector() -> None:
    connector = SocrataConnector(max_pages=1, page_size=100, since_days=None)
    assert isinstance(connector, SourceConnector)
    assert connector.source_code == "catalunya"
    assert connector.dataset == CATALUNYA


def test_catalunya_discover_builds_stable_page_artifacts() -> None:
    connector = SocrataConnector(
        page_size=500, max_pages=2, start_offset=0, since_days=None
    )
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
    assert "data_publicacio_anunci" in unquote(first.source_url or "")
    assert first.metadata["dataset_id"] == "ybgg-dgi6"
    assert second.metadata["offset"] == 500


def test_catalunya_discover_includes_since_where() -> None:
    fixed = datetime(2026, 11, 5, 12, 0, tzinfo=ZoneInfo("Europe/Madrid"))
    since = madrid_since_iso(7, now=fixed)
    connector = SocrataConnector(page_size=1000, max_pages=1, since_days=7)
    # Force deterministic since by patching via constructing where from same helper
    # Discover uses datetime.now; we assert shape and that $where is present.
    artifacts = connector.discover(
        SyncContext(source_code="catalunya", run_id="discover-where")
    )
    assert len(artifacts) == 1
    url = unquote(artifacts[0].source_url or "")
    assert "$where=" in (artifacts[0].source_url or "")
    assert "data_publicacio_anunci >=" in url
    assert artifacts[0].metadata["since_days"] == 7
    assert artifacts[0].metadata["since_iso"].startswith("20")
    # sanity: helper agrees on calendar math for a known instant
    assert since == "2026-10-29T00:00:00"


def test_catalunya_discover_respects_cursor() -> None:
    connector = SocrataConnector(page_size=100, max_pages=2, since_days=None)
    cursor = "ybgg-dgi6_offset_0000000_limit_0100.json"
    context = SyncContext(
        source_code="catalunya",
        run_id="discover-cat-cursor",
        cursor=cursor,
    )
    artifacts = connector.discover(context)
    assert len(artifacts) == 1
    assert artifacts[0].artifact_key == "ybgg-dgi6_offset_0000100_limit_0100.json"
