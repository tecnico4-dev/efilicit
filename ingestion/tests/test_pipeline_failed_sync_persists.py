"""Tras rollback del upsert, source_sync failed debe quedar persistido."""

from __future__ import annotations

import uuid
from typing import Iterable

import psycopg
import pytest

from efilicit_ingestion.models import RemoteArtifact, SourceRecord, SyncContext
from efilicit_ingestion.pipeline.db_run import run_pipeline_postgres
from efilicit_ingestion.pipeline.ports import InMemoryArtifactStore, InMemorySyncRepository
from efilicit_ingestion.pipeline.postgres import connect, default_database_url
from efilicit_ingestion.pipeline.runner import PipelineRunError, run_pipeline

SOURCE_CODE = "stub-fail"


class _BoomAfterFetchConnector:
    """Descubre y descarga, pero falla en parse (simula fallo a mitad de corrida)."""

    source_code = SOURCE_CODE

    def discover(self, context: SyncContext) -> list[RemoteArtifact]:
        _ = context
        return [
            RemoteArtifact(
                artifact_key="boom-artifact",
                source_url="https://example.invalid/boom.json",
                content_type="application/json",
            )
        ]

    def fetch(self, artifact: RemoteArtifact) -> bytes:
        _ = artifact
        return b'{"ok": true}'

    def parse(
        self,
        raw: bytes,
        artifact: RemoteArtifact,
    ) -> Iterable[SourceRecord]:
        _ = raw
        raise RuntimeError(f"parse exploded for {artifact.artifact_key}")


def _db_available() -> bool:
    try:
        with psycopg.connect(default_database_url(), connect_timeout=2) as conn:
            conn.execute("select 1")
        return True
    except psycopg.Error:
        return False


def test_pipeline_run_error_keeps_failed_status_in_memory() -> None:
    connector = _BoomAfterFetchConnector()
    sync_repo = InMemorySyncRepository()
    with pytest.raises(PipelineRunError) as caught:
        run_pipeline(
            connector,
            SyncContext(source_code=SOURCE_CODE, run_id="mem-fail-1"),
            artifact_store=InMemoryArtifactStore(),
            sync_repo=sync_repo,
        )
    assert "parse exploded" in str(caught.value)
    assert caught.value.sync.status == "failed"
    run = sync_repo.runs[(SOURCE_CODE, "mem-fail-1")]
    assert run.status == "failed"
    assert run.error_message is not None
    assert "parse exploded" in run.error_message


@pytest.mark.skipif(not _db_available(), reason="Local Supabase Postgres not reachable")
def test_failed_run_persists_after_transaction_rollback() -> None:
    run_id = f"fail-{uuid.uuid4()}"
    connector = _BoomAfterFetchConnector()

    with connect() as conn:
        conn.execute(
            "delete from public.source_sync where source_code = %s",
            (SOURCE_CODE,),
        )
        conn.commit()

    with pytest.raises(RuntimeError, match="parse exploded"):
        run_pipeline_postgres(
            connector,
            SyncContext(source_code=SOURCE_CODE, run_id=run_id),
            artifact_store=InMemoryArtifactStore(),
        )

    with connect() as conn:
        row = conn.execute(
            """
            select status, error_message, records_failed
            from public.source_sync
            where source_code = %s and run_id = %s
            """,
            (SOURCE_CODE, run_id),
        ).fetchone()
        conn.execute(
            "delete from public.source_sync where source_code = %s and run_id = %s",
            (SOURCE_CODE, run_id),
        )
        conn.commit()

    assert row is not None
    assert row[0] == "failed"
    assert row[1] is not None and "parse exploded" in row[1]
    assert row[2] >= 1
