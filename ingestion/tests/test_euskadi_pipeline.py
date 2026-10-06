"""Upsert + RAW pipeline tests for euskadi (Semana 3 Paso 9). No live network."""

from __future__ import annotations

from pathlib import Path

import psycopg
import pytest

from efilicit_ingestion.connectors.euskadi import EuskadiConnector
from efilicit_ingestion.connectors.euskadi.parser import parse_euskadi_artifact
from efilicit_ingestion.models import RemoteArtifact, SyncContext
from efilicit_ingestion.pipeline import (
    InMemoryArtifactStore,
    InMemorySyncRepository,
    run_pipeline,
    stages,
)
from efilicit_ingestion.pipeline.canonical_repo import (
    InMemoryCanonicalRepository,
    PostgresCanonicalRepository,
)
from efilicit_ingestion.pipeline.postgres import connect, default_database_url
from efilicit_ingestion.pipeline.raw import fetch_validate_and_store_raw
from efilicit_ingestion.pipeline.supabase_storage import SupabaseStorageArtifactStore
import httpx

FIXTURE = Path(__file__).parent / "fixtures" / "euskadi" / "valid_page.json"
SOURCE_CODE = "euskadi"
ID_1 = "900001"


def _artifact() -> RemoteArtifact:
    return RemoteArtifact(
        artifact_key="contracting-notices_page_000001.json",
        source_url="https://api.euskadi.eus/procurements/contracting-notices?currentPage=1",
        content_type="application/json",
    )


def _normalized():
    return stages.resolve_identity(
        stages.normalize(list(parse_euskadi_artifact(FIXTURE.read_bytes(), _artifact())))
    )


def test_euskadi_raw_path_prefix_without_network() -> None:
    body = FIXTURE.read_bytes()
    uploaded: dict[str, bytes] = {}

    def storage_handler(request: httpx.Request) -> httpx.Response:
        assert "/storage/v1/object/raw/euskadi/" in str(request.url)
        uploaded[str(request.url)] = request.content
        return httpx.Response(200, json={"ok": True})

    http = httpx.Client(transport=httpx.MockTransport(storage_handler))
    store = SupabaseStorageArtifactStore(
        base_url="http://storage.test",
        service_role_key="test-key",
        http_client=http,
    )
    connector = EuskadiConnector(
        fetch_transport=lambda _u: (200, {"content-type": "application/json"}, body),
    )
    stored = fetch_validate_and_store_raw(connector, _artifact(), artifact_store=store)
    http.close()
    assert stored.storage_path.startswith("raw/euskadi/")
    assert body in uploaded.values()


def test_euskadi_upsert_idempotent_and_pipeline_sync() -> None:
    body = FIXTURE.read_bytes()
    connector = EuskadiConnector(
        max_pages=1,
        fetch_transport=lambda _u: (200, {"content-type": "application/json"}, body),
    )
    canonical = InMemoryCanonicalRepository()
    first = run_pipeline(
        connector,
        SyncContext(source_code=SOURCE_CODE, run_id="eus-1"),
        artifact_store=InMemoryArtifactStore(),
        sync_repo=InMemorySyncRepository(),
        canonical_repo=canonical,
    )
    assert first.sync.status == "success"
    assert first.sync.records_seen == 2
    assert first.sync.records_new == 2
    assert first.stored_artifacts[0].storage_path.startswith("raw/euskadi/")

    second = run_pipeline(
        connector,
        SyncContext(source_code=SOURCE_CODE, run_id="eus-2"),
        artifact_store=InMemoryArtifactStore(),
        sync_repo=InMemorySyncRepository(),
        canonical_repo=canonical,
    )
    assert second.sync.records_new == 0
    assert second.sync.records_updated == 0
    assert len(canonical.tender_sources) == 2


def _db_available() -> bool:
    try:
        with psycopg.connect(default_database_url(), connect_timeout=2) as conn:
            conn.execute("select 1")
        return True
    except psycopg.Error:
        return False


@pytest.mark.skipif(not _db_available(), reason="Local Supabase Postgres not reachable")
def test_euskadi_postgres_upsert_does_not_duplicate() -> None:
    records = _normalized()
    with connect() as conn:
        for r in records:
            sid = r.payload["canonical"]["source_tender_id"]
            conn.execute(
                """
                delete from public.tenders t
                using public.tender_sources ts
                where ts.tender_id = t.id
                  and ts.source_code = %s and ts.source_tender_id = %s
                """,
                (SOURCE_CODE, sid),
            )
        conn.execute(
            "delete from public.contracting_authorities where tax_id = %s",
            ("S4833001C",),
        )
        conn.commit()
        repo = PostgresCanonicalRepository(conn)
        first = repo.upsert_records(source_code=SOURCE_CODE, records=records)
        second = repo.upsert_records(source_code=SOURCE_CODE, records=records)
        conn.commit()
        assert first.new == 2 and second.updated == 0
        row = conn.execute(
            """
            select t.title, a.tax_id, a.identity_confidence
            from public.tenders t
            join public.tender_sources ts on ts.tender_id = t.id
            left join public.contracting_authorities a on a.id = t.contracting_authority_id
            where ts.source_code = %s and ts.source_tender_id = %s
            """,
            (SOURCE_CODE, ID_1),
        ).fetchone()
        assert row is not None
        assert row[0].startswith("Suministro")
        assert row[1] == "S4833001C"
        assert row[2] == "HIGH"
