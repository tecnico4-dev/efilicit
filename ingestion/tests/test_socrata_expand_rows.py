"""Expand + incremental RAW por fila Catalunya (ADR 025)."""

from __future__ import annotations

import json
from pathlib import Path

from efilicit_ingestion.connectors.socrata import CATALUNYA, SocrataConnector
from efilicit_ingestion.connectors.socrata.expand_rows import (
    expand_socrata_rows,
    row_artifact_key,
)
from efilicit_ingestion.connectors.socrata.urls import page_artifact_key, page_resource_url
from efilicit_ingestion.models import RemoteArtifact, SyncContext
from efilicit_ingestion.pipeline.canonical_repo import InMemoryCanonicalRepository
from efilicit_ingestion.pipeline.catalunya_incremental import (
    run_pipeline_catalunya_incremental,
)
from efilicit_ingestion.pipeline.ports import InMemoryArtifactStore, InMemorySyncRepository

FIXTURE = Path(__file__).parent / "fixtures" / "catalunya" / "valid_page.json"
FAKE_JSON = FIXTURE.read_bytes()


def _page() -> RemoteArtifact:
    return RemoteArtifact(
        artifact_key=page_artifact_key(CATALUNYA, offset=0, limit=1000),
        source_url=page_resource_url(CATALUNYA, offset=0, limit=1000),
        content_type="application/json",
        metadata={"dataset_id": CATALUNYA.dataset_id, "offset": 0, "limit": 1000},
    )


def test_expand_socrata_rows_skips_missing_id_intern() -> None:
    rows = expand_socrata_rows(FAKE_JSON, _page())
    assert len(rows) == 2
    assert {r.source_record_id for r in rows} == {
        "aaaaaaaa-bbbb-cccc-dddd-000000000001",
        "aaaaaaaa-bbbb-cccc-dddd-000000000002",
    }
    for row in rows:
        assert row.artifact_key == row_artifact_key(row.checksum)
        assert row.artifact_key.startswith("rows/")
        assert row.raw.startswith(b"{")
        assert json.loads(row.raw)["id_intern"] == row.source_record_id


def test_expand_socrata_rows_checksum_stable() -> None:
    first = expand_socrata_rows(FAKE_JSON, _page())
    again = expand_socrata_rows(FAKE_JSON, _page())
    assert [r.checksum for r in first] == [r.checksum for r in again]


def test_catalunya_incremental_second_run_skips_known_checksums() -> None:
    fixture_bytes = FAKE_JSON
    store = InMemoryArtifactStore()
    sync_repo = InMemorySyncRepository()
    connector = SocrataConnector(
        page_size=1000,
        max_pages=1,
        since_days=None,
        fetch_transport=lambda url, data=fixture_bytes: (
            200,
            {"content-type": "application/json", "content-length": str(len(data))},
            data,
        ),
    )

    first = run_pipeline_catalunya_incremental(
        connector,
        SyncContext(source_code="catalunya", run_id="cat-inc-1"),
        artifact_store=store,
        sync_repo=sync_repo,
        canonical_repo=InMemoryCanonicalRepository(),
    )
    assert first.sync.status == "success"
    assert first.records_processed == 2
    assert len(first.stored_artifacts) == 2
    n_first = len(store.objects)

    second = run_pipeline_catalunya_incremental(
        connector,
        SyncContext(source_code="catalunya", run_id="cat-inc-2"),
        artifact_store=store,
        sync_repo=sync_repo,
        canonical_repo=InMemoryCanonicalRepository(),
    )
    assert second.sync.status == "success"
    assert second.stored_artifacts == []
    assert second.records_processed == 0
    assert len(store.objects) == n_first
    assert second.sync.checksum == "skipped_rows=2"


def test_catalunya_incremental_changed_row_uploads_again() -> None:
    page = json.loads(FAKE_JSON.decode("utf-8"))
    # Solo la primera fila con id (índice 0); tocamos un campo.
    page[0]["denominacio"] = "Título modificado para checksum nuevo"
    touched = json.dumps(page).encode("utf-8")

    store = InMemoryArtifactStore()
    sync_repo = InMemorySyncRepository()

    def transport_factory(payload: bytes):
        return lambda url, data=payload: (
            200,
            {"content-type": "application/json", "content-length": str(len(data))},
            data,
        )

    first_connector = SocrataConnector(
        page_size=1000,
        max_pages=1,
        since_days=None,
        fetch_transport=transport_factory(FAKE_JSON),
    )
    run_pipeline_catalunya_incremental(
        first_connector,
        SyncContext(source_code="catalunya", run_id="cat-chg-1"),
        artifact_store=store,
        sync_repo=sync_repo,
        canonical_repo=InMemoryCanonicalRepository(),
    )
    before = len(store.objects)

    second_connector = SocrataConnector(
        page_size=1000,
        max_pages=1,
        since_days=None,
        fetch_transport=transport_factory(touched),
    )
    second = run_pipeline_catalunya_incremental(
        second_connector,
        SyncContext(source_code="catalunya", run_id="cat-chg-2"),
        artifact_store=store,
        sync_repo=sync_repo,
        canonical_repo=InMemoryCanonicalRepository(),
    )
    assert second.sync.status == "success"
    # Una fila cambiada + una igual → 1 upload nuevo; 1 skip.
    assert len(second.stored_artifacts) == 1
    assert len(store.objects) == before + 1
    assert second.records_processed == 1
    # checksum del run = última fila subida (el skip no pisa si hubo store)
