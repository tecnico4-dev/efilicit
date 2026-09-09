"""Contract tests for SourceConnector (Semana 1)."""

from __future__ import annotations

from efilicit_ingestion.connectors import SourceConnector, StubSourceConnector
from efilicit_ingestion.models import SyncContext


def test_stub_is_source_connector() -> None:
    connector = StubSourceConnector()
    assert isinstance(connector, SourceConnector)
    assert connector.source_code == "stub"


def test_stub_discover_fetch_parse_roundtrip() -> None:
    connector = StubSourceConnector()
    context = SyncContext(source_code=connector.source_code, run_id="test-run-1")

    artifacts = connector.discover(context)
    assert len(artifacts) == 1
    artifact = artifacts[0]
    assert artifact.artifact_key == "stub-artifact-1"

    raw = connector.fetch(artifact)
    assert isinstance(raw, (bytes, bytearray))
    assert len(raw) > 0

    records = list(connector.parse(raw, artifact))
    assert len(records) == 1
    assert records[0].source_record_id == "stub-artifact-1"
    assert records[0].payload["title"]
