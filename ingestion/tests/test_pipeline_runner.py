"""Minimal pipeline runner test with StubSourceConnector (Semana 1 Paso 6)."""

from __future__ import annotations

from efilicit_ingestion.connectors import StubSourceConnector
from efilicit_ingestion.models import SyncContext
from efilicit_ingestion.pipeline import (
    InMemoryArtifactStore,
    InMemorySyncRepository,
    run_pipeline,
)


def test_run_pipeline_with_stub_connector() -> None:
    connector = StubSourceConnector()
    store = InMemoryArtifactStore()
    sync_repo = InMemorySyncRepository()
    context = SyncContext(source_code=connector.source_code, run_id="pipeline-test-1")

    result = run_pipeline(
        connector,
        context,
        artifact_store=store,
        sync_repo=sync_repo,
    )

    assert result.sync.status == "success"
    assert result.records_processed == 1
    assert len(result.stored_artifacts) == 1

    stored = result.stored_artifacts[0]
    assert stored.checksum
    assert stored.storage_path.startswith("raw/stub/")
    assert stored.storage_path in store.objects
    assert store.objects[stored.storage_path]

    run = sync_repo.runs[(connector.source_code, "pipeline-test-1")]
    assert run.records_seen == 1
    assert run.records_new == 1
    assert run.last_artifact == "stub-artifact-1"
    assert run.cursor == "stub-artifact-1"
