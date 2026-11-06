"""Expand + incremental RAW por aviso Euskadi (ADR 025)."""

from __future__ import annotations

import json
from pathlib import Path

from efilicit_ingestion.connectors.euskadi import EuskadiConnector
from efilicit_ingestion.connectors.euskadi.expand_items import (
    expand_euskadi_items,
    item_artifact_key,
)
from efilicit_ingestion.models import RemoteArtifact, SyncContext
from efilicit_ingestion.pipeline.canonical_repo import InMemoryCanonicalRepository
from efilicit_ingestion.pipeline.euskadi_incremental import (
    run_pipeline_euskadi_incremental,
)
from efilicit_ingestion.pipeline.ports import InMemoryArtifactStore, InMemorySyncRepository

FIXTURE = Path(__file__).parent / "fixtures" / "euskadi" / "valid_page.json"
FAKE_JSON = FIXTURE.read_bytes()


def _page() -> RemoteArtifact:
    return RemoteArtifact(
        artifact_key="contracting-notices_page_000001.json",
        source_url="https://api.euskadi.eus/procurements/contracting-notices?currentPage=1",
        content_type="application/json",
    )


def test_expand_euskadi_items_skips_missing_id() -> None:
    items = expand_euskadi_items(FAKE_JSON, _page())
    assert len(items) == 2
    assert {i.source_record_id for i in items} == {"900001", "900002"}
    for item in items:
        assert item.artifact_key == item_artifact_key(item.checksum)
        assert item.artifact_key.startswith("rows/")
        assert json.loads(item.raw)["id"] == int(item.source_record_id)


def test_expand_euskadi_items_checksum_stable() -> None:
    first = expand_euskadi_items(FAKE_JSON, _page())
    again = expand_euskadi_items(FAKE_JSON, _page())
    assert [i.checksum for i in first] == [i.checksum for i in again]


def test_euskadi_incremental_second_run_skips_known_checksums() -> None:
    store = InMemoryArtifactStore()
    sync_repo = InMemorySyncRepository()
    connector = EuskadiConnector(
        max_pages=1,
        fetch_transport=lambda url, data=FAKE_JSON: (
            200,
            {"content-type": "application/json", "content-length": str(len(data))},
            data,
        ),
    )

    first = run_pipeline_euskadi_incremental(
        connector,
        SyncContext(source_code="euskadi", run_id="eus-inc-1"),
        artifact_store=store,
        sync_repo=sync_repo,
        canonical_repo=InMemoryCanonicalRepository(),
    )
    assert first.sync.status == "success"
    assert first.records_processed == 2
    assert len(first.stored_artifacts) == 2
    n_first = len(store.objects)

    second = run_pipeline_euskadi_incremental(
        connector,
        SyncContext(source_code="euskadi", run_id="eus-inc-2"),
        artifact_store=store,
        sync_repo=sync_repo,
        canonical_repo=InMemoryCanonicalRepository(),
    )
    assert second.sync.status == "success"
    assert second.stored_artifacts == []
    assert second.records_processed == 0
    assert len(store.objects) == n_first
    assert second.sync.checksum == "skipped_items=2"


def test_euskadi_incremental_changed_item_uploads_again() -> None:
    page = json.loads(FAKE_JSON.decode("utf-8"))
    page["items"][0]["object"] = "Título modificado para checksum nuevo"
    touched = json.dumps(page).encode("utf-8")

    store = InMemoryArtifactStore()
    sync_repo = InMemorySyncRepository()

    def transport_factory(payload: bytes):
        return lambda url, data=payload: (
            200,
            {"content-type": "application/json", "content-length": str(len(data))},
            data,
        )

    first = run_pipeline_euskadi_incremental(
        EuskadiConnector(max_pages=1, fetch_transport=transport_factory(FAKE_JSON)),
        SyncContext(source_code="euskadi", run_id="eus-chg-1"),
        artifact_store=store,
        sync_repo=sync_repo,
        canonical_repo=InMemoryCanonicalRepository(),
    )
    assert first.records_processed == 2
    before = len(store.objects)

    second = run_pipeline_euskadi_incremental(
        EuskadiConnector(max_pages=1, fetch_transport=transport_factory(touched)),
        SyncContext(source_code="euskadi", run_id="eus-chg-2"),
        artifact_store=store,
        sync_repo=sync_repo,
        canonical_repo=InMemoryCanonicalRepository(),
    )
    assert second.sync.status == "success"
    assert len(second.stored_artifacts) == 1
    assert len(store.objects) == before + 1
    assert second.records_processed == 1
