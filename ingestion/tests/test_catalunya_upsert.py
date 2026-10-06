"""Upsert + source_sync + trazabilidad for catalunya (Semana 3 Paso 8.3).

Reuses Semana 2 canonical repo / pipeline; unique key is
``(catalunya, source_tender_id)`` with ``id_intern``. No live SODA network.
"""

from __future__ import annotations

from pathlib import Path

import psycopg
import pytest

from efilicit_ingestion.connectors.socrata import CATALUNYA, SocrataConnector
from efilicit_ingestion.connectors.socrata.parser import parse_socrata_artifact
from efilicit_ingestion.connectors.socrata.urls import page_artifact_key, page_resource_url
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

FIXTURE = Path(__file__).parent / "fixtures" / "catalunya" / "valid_page.json"
SOURCE_CODE = "catalunya"
ARTIFACT_ID = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff"
ID_1 = "aaaaaaaa-bbbb-cccc-dddd-000000000001"
ID_2 = "aaaaaaaa-bbbb-cccc-dddd-000000000002"


def _catalunya_artifact() -> RemoteArtifact:
    return RemoteArtifact(
        artifact_key=page_artifact_key(CATALUNYA, offset=0, limit=1000),
        source_url=page_resource_url(CATALUNYA, offset=0, limit=1000),
        content_type="application/json",
        metadata={"dataset_id": CATALUNYA.dataset_id},
    )


def _normalized_catalunya_records():
    records = list(parse_socrata_artifact(FIXTURE.read_bytes(), _catalunya_artifact()))
    return stages.resolve_identity(stages.normalize(records))


def test_catalunya_inmemory_upsert_is_idempotent_and_links_artifact() -> None:
    repo = InMemoryCanonicalRepository()
    records = _normalized_catalunya_records()
    assert len(records) == 2

    first = repo.upsert_records(
        source_code=SOURCE_CODE,
        records=records,
        artifact_id=ARTIFACT_ID,
    )
    second = repo.upsert_records(
        source_code=SOURCE_CODE,
        records=records,
        artifact_id=ARTIFACT_ID,
    )

    assert first.seen == 2 and first.new == 2 and first.updated == 0
    assert second.seen == 2 and second.new == 0 and second.updated == 2
    assert len(repo.tenders) == 2
    assert len(repo.tender_sources) == 2
    # Dos DIR3 distintos en la fixture → dos organismos; re-ingesta no crea más.
    assert len(repo.authorities) == 2

    key = (SOURCE_CODE, ID_1)
    assert key in repo.tender_sources
    assert repo.tender_sources[key]["artifact_id"] == ARTIFACT_ID
    assert (SOURCE_CODE, ID_2) in repo.tender_sources
    assert [e["event_type"] for e in repo.events] == [
        "published",
        "awarded",
        "updated",
        "updated",
    ]
    assert len(repo.documents) == 2
    assert all(d["artifact_id"] == ARTIFACT_ID for d in repo.documents)


def test_catalunya_source_code_does_not_collide_with_placsp() -> None:
    repo = InMemoryCanonicalRepository()
    records = _normalized_catalunya_records()[:1]

    repo.upsert_records(source_code="placsp", records=records)
    repo.upsert_records(source_code=SOURCE_CODE, records=records)

    assert len(repo.tender_sources) == 2
    assert ("placsp", ID_1) in repo.tender_sources
    assert (SOURCE_CODE, ID_1) in repo.tender_sources
    assert len(repo.tenders) == 2


def test_catalunya_pipeline_updates_source_sync_and_does_not_duplicate() -> None:
    """Fixture JSON → pipeline: sync success + counters; 2ª pasada → updated."""
    body = FIXTURE.read_bytes()
    connector = SocrataConnector(
        page_size=1000,
        max_pages=1,
        fetch_transport=lambda _url: (200, {"content-type": "application/json"}, body),
    )
    store = InMemoryArtifactStore()
    sync_repo = InMemorySyncRepository()
    canonical = InMemoryCanonicalRepository()

    first = run_pipeline(
        connector,
        SyncContext(source_code=SOURCE_CODE, run_id="catalunya-upsert-1"),
        artifact_store=store,
        sync_repo=sync_repo,
        canonical_repo=canonical,
    )
    assert first.sync.status == "success"
    assert first.sync.records_seen == 2
    assert first.sync.records_new == 2
    assert first.sync.records_updated == 0
    assert first.stored_artifacts[0].storage_path.startswith("raw/catalunya/")
    assert len(canonical.tenders) == 2
    assert (SOURCE_CODE, ID_1) in canonical.tender_sources

    second = run_pipeline(
        connector,
        SyncContext(source_code=SOURCE_CODE, run_id="catalunya-upsert-2"),
        artifact_store=store,
        sync_repo=sync_repo,
        canonical_repo=canonical,
    )
    assert second.sync.status == "success"
    assert second.sync.records_new == 0
    assert second.sync.records_updated == 2
    assert len(canonical.tenders) == 2
    assert len(canonical.tender_sources) == 2


def _db_available() -> bool:
    try:
        with psycopg.connect(default_database_url(), connect_timeout=2) as conn:
            conn.execute("select 1")
        return True
    except psycopg.Error:
        return False


@pytest.mark.skipif(not _db_available(), reason="Local Supabase Postgres not reachable")
def test_catalunya_postgres_upsert_does_not_duplicate() -> None:
    records = _normalized_catalunya_records()
    ids = [r.payload["canonical"]["source_tender_id"] for r in records]

    with connect() as conn:
        for source_tender_id in ids:
            conn.execute(
                """
                delete from public.tenders t
                using public.tender_sources ts
                where ts.tender_id = t.id
                  and ts.source_code = %s
                  and ts.source_tender_id = %s
                """,
                (SOURCE_CODE, source_tender_id),
            )
        conn.execute(
            """
            delete from public.contracting_authorities
            where name_normalized in (%s, %s)
            """,
            (
                "ajuntament fixture de proves",
                "diputacio fixture",
            ),
        )
        conn.commit()

        repo = PostgresCanonicalRepository(conn)
        first = repo.upsert_records(source_code=SOURCE_CODE, records=records)
        second = repo.upsert_records(source_code=SOURCE_CODE, records=records)
        conn.commit()

        assert first.new == 2 and first.updated == 0
        assert second.new == 0 and second.updated == 2

        count = conn.execute(
            """
            select count(*)
            from public.tender_sources
            where source_code = %s and source_tender_id = any(%s)
            """,
            (SOURCE_CODE, ids),
        ).fetchone()
        assert count is not None and count[0] == 2

        row = conn.execute(
            """
            select t.title, t.status, t.cpv_code, a.name, a.identity_confidence
            from public.tenders t
            join public.tender_sources ts on ts.tender_id = t.id
            left join public.contracting_authorities a on a.id = t.contracting_authority_id
            where ts.source_code = %s and ts.source_tender_id = %s
            """,
            (SOURCE_CODE, ID_1),
        ).fetchone()
        assert row is not None
        assert row[0].startswith("Suministro")
        assert row[1] == "published"
        assert row[2] == "30192700"
        assert "Ajuntament Fixture" in (row[3] or "")
        assert row[4] == "MEDIUM"
