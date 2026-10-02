"""Integración: el stub del pipeline persiste source_sync / source_artifacts en Postgres local.

En CI sin Supabase estos tests se saltan (ADR 004).
"""

from __future__ import annotations

import uuid

import psycopg
import pytest

from efilicit_ingestion.connectors import StubSourceConnector
from efilicit_ingestion.models import SyncContext
from efilicit_ingestion.pipeline import InMemoryArtifactStore, run_pipeline
from efilicit_ingestion.pipeline.postgres import (
    PostgresSyncRepository,
    connect,
    default_database_url,
)

SOURCE_CODE = "stub"


def _db_available() -> bool:
    try:
        with psycopg.connect(default_database_url(), connect_timeout=2) as conn:
            conn.execute("select 1")
        return True
    except psycopg.Error:
        return False


pytestmark = pytest.mark.skipif(
    not _db_available(),
    reason="Postgres local de Supabase no alcanzable (arrancar con supabase start)",
)


@pytest.fixture
def db_conn():
    with connect() as conn:
        conn.execute(
            "delete from public.source_artifacts where source_code = %s",
            (SOURCE_CODE,),
        )
        conn.execute(
            "delete from public.source_sync where source_code = %s",
            (SOURCE_CODE,),
        )
        conn.commit()
        yield conn
        conn.execute(
            "delete from public.source_artifacts where source_code = %s",
            (SOURCE_CODE,),
        )
        conn.execute(
            "delete from public.source_sync where source_code = %s",
            (SOURCE_CODE,),
        )
        conn.commit()


def test_pipeline_persists_sync_and_artifacts(db_conn: psycopg.Connection) -> None:
    connector = StubSourceConnector()
    store = InMemoryArtifactStore()
    sync_repo = PostgresSyncRepository(db_conn)
    run_id = f"itest-{uuid.uuid4()}"

    result = run_pipeline(
        connector,
        SyncContext(source_code=SOURCE_CODE, run_id=run_id),
        artifact_store=store,
        sync_repo=sync_repo,
    )
    db_conn.commit()

    assert result.sync.status == "success"
    assert result.sync.id is not None

    sync_row = db_conn.execute(
        """
        select status, records_seen, records_new, last_artifact, checksum
        from public.source_sync
        where source_code = %s and run_id = %s
        """,
        (SOURCE_CODE, run_id),
    ).fetchone()
    assert sync_row is not None
    assert sync_row[0] == "success"
    assert sync_row[1] == 1
    assert sync_row[2] == 1
    assert sync_row[3] == "stub-artifact-1"
    assert sync_row[4] == result.stored_artifacts[0].checksum

    artifact_row = db_conn.execute(
        """
        select storage_path, checksum, byte_size, sync_id
        from public.source_artifacts
        where source_code = %s and artifact_key = %s
        """,
        (SOURCE_CODE, "stub-artifact-1"),
    ).fetchone()
    assert artifact_row is not None
    assert artifact_row[0] == result.stored_artifacts[0].storage_path
    assert artifact_row[1] == result.stored_artifacts[0].checksum
    assert artifact_row[2] == result.stored_artifacts[0].byte_size
    assert str(artifact_row[3]) == result.sync.id


def test_artifact_reregister_is_idempotent(db_conn: psycopg.Connection) -> None:
    connector = StubSourceConnector()
    store = InMemoryArtifactStore()
    sync_repo = PostgresSyncRepository(db_conn)

    run_pipeline(
        connector,
        SyncContext(source_code=SOURCE_CODE, run_id=f"itest-a-{uuid.uuid4()}"),
        artifact_store=store,
        sync_repo=sync_repo,
    )
    run_pipeline(
        connector,
        SyncContext(source_code=SOURCE_CODE, run_id=f"itest-b-{uuid.uuid4()}"),
        artifact_store=store,
        sync_repo=sync_repo,
    )
    db_conn.commit()

    sync_count = db_conn.execute(
        "select count(*) from public.source_sync where source_code = %s",
        (SOURCE_CODE,),
    ).fetchone()
    artifact_count = db_conn.execute(
        "select count(*) from public.source_artifacts where source_code = %s",
        (SOURCE_CODE,),
    ).fetchone()

    assert sync_count is not None and sync_count[0] == 2
    assert artifact_count is not None and artifact_count[0] == 1


def test_default_database_url_points_at_local_supabase() -> None:
    assert "54322" in default_database_url()
