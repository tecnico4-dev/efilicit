"""Upsert + source_sync + trazabilidad for placsp_menores (Semana 4 Paso 2.3).

Reuses Semana 2 canonical repo / pipeline; unique key is
``(placsp_menores, source_tender_id)``. No live PLACSP network.
"""

from __future__ import annotations

import zipfile
from datetime import date
from io import BytesIO
from pathlib import Path

import psycopg
import pytest

from efilicit_ingestion.connectors.placsp import PLACSP_MENORES, PlacspConnector
from efilicit_ingestion.connectors.placsp.parser import parse_placsp_artifact
from efilicit_ingestion.models import RemoteArtifact, SyncContext
from efilicit_ingestion.pipeline import (
    InMemoryArtifactStore,
    InMemorySyncRepository,
    run_pipeline,
    stages,
)
from efilicit_ingestion.pipeline.canonical_repo import (
    EVENT_TYPE_INGESTED,
    InMemoryCanonicalRepository,
    PostgresCanonicalRepository,
)
from efilicit_ingestion.pipeline.postgres import connect, default_database_url

FIXTURES = Path(__file__).parent / "fixtures" / "placsp"
SOURCE_CODE = "placsp_menores"
ARTIFACT_ID = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff"


def _menores_artifact(name: str = "valid_single_entry.atom") -> RemoteArtifact:
    return RemoteArtifact(
        artifact_key=name,
        source_url=(
            "https://contrataciondelsectorpublico.gob.es/sindicacion/"
            "sindicacion_1143/contratosMenoresPerfilesContratantes.atom"
        ),
        content_type="application/atom+xml",
        metadata={
            "sindicacion": "1143",
            "feed_base": "contratosMenoresPerfilesContratantes",
        },
    )


def _normalized_menores_records(
    fixture_name: str = "valid_single_entry.atom",
):
    raw = (FIXTURES / fixture_name).read_bytes()
    records = list(parse_placsp_artifact(raw, _menores_artifact(fixture_name)))
    return stages.resolve_identity(stages.normalize(records))


def _menores_zip_bytes() -> bytes:
    buf = BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr(
            "contratosMenoresPerfilesContratantes.atom",
            (FIXTURES / "valid_single_entry.atom").read_bytes(),
        )
    return buf.getvalue()


def test_menores_inmemory_upsert_is_idempotent_and_links_artifact() -> None:
    repo = InMemoryCanonicalRepository()
    records = _normalized_menores_records()

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

    assert first.seen == 1 and first.new == 1 and first.updated == 0
    assert second.seen == 1 and second.new == 0 and second.updated == 0
    assert len(repo.tenders) == 1
    assert len(repo.tender_sources) == 1

    key = (SOURCE_CODE, "B00000000:EXP/2026/0001")
    assert key in repo.tender_sources
    assert repo.tender_sources[key]["artifact_id"] == ARTIFACT_ID
    assert [e["event_type"] for e in repo.events] == [EVENT_TYPE_INGESTED]
    assert [e["event_status"] for e in repo.events] == ["publicada"]
    assert len(repo.documents) == 1
    assert repo.documents[0]["artifact_id"] == ARTIFACT_ID


def test_menores_source_code_does_not_collide_with_placsp() -> None:
    """Mismo source_tender_id bajo source_codes distintos → dos tender_sources."""
    repo = InMemoryCanonicalRepository()
    records = _normalized_menores_records()

    repo.upsert_records(source_code="placsp", records=records)
    repo.upsert_records(source_code=SOURCE_CODE, records=records)

    assert len(repo.tender_sources) == 2
    assert ("placsp", "B00000000:EXP/2026/0001") in repo.tender_sources
    assert (SOURCE_CODE, "B00000000:EXP/2026/0001") in repo.tender_sources
    # Two tenders (cross-source merge is Semana 4 Pasos 4–7, not here).
    assert len(repo.tenders) == 2


def test_menores_pipeline_updates_source_sync_and_does_not_duplicate() -> None:
    """Fixture ZIP → pipeline: sync success + counters; 2ª pasada → updated."""
    zip_bytes = _menores_zip_bytes()
    connector = PlacspConnector(
        syndication=PLACSP_MENORES,
        as_of=date(2026, 9, 17),
        fetch_transport=lambda _url: (
            200,
            {"content-type": "application/zip"},
            zip_bytes,
        ),
    )
    store = InMemoryArtifactStore()
    sync_repo = InMemorySyncRepository()
    canonical = InMemoryCanonicalRepository()

    first = run_pipeline(
        connector,
        SyncContext(source_code=SOURCE_CODE, run_id="menores-upsert-1"),
        artifact_store=store,
        sync_repo=sync_repo,
        canonical_repo=canonical,
    )
    assert first.sync.status == "success"
    assert first.sync.records_seen == 1
    assert first.sync.records_new == 1
    assert first.sync.records_updated == 0
    assert first.stored_artifacts[0].storage_path.startswith("raw/placsp_menores/")
    assert len(canonical.tenders) == 1
    assert (SOURCE_CODE, "B00000000:EXP/2026/0001") in canonical.tender_sources

    second = run_pipeline(
        connector,
        SyncContext(source_code=SOURCE_CODE, run_id="menores-upsert-2"),
        artifact_store=store,
        sync_repo=sync_repo,
        canonical_repo=canonical,
    )
    assert second.sync.status == "success"
    assert second.sync.records_new == 0
    assert second.sync.records_updated == 0
    assert len(canonical.tenders) == 1
    assert len(canonical.tender_sources) == 1


def _db_available() -> bool:
    try:
        with psycopg.connect(default_database_url(), connect_timeout=2) as conn:
            conn.execute("select 1")
        return True
    except psycopg.Error:
        return False


@pytest.mark.skipif(not _db_available(), reason="Local Supabase Postgres not reachable")
def test_menores_postgres_upsert_does_not_duplicate() -> None:
    records = _normalized_menores_records()
    source_tender_id = records[0].payload["canonical"]["source_tender_id"]

    with connect() as conn:
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
            "delete from public.contracting_authorities where tax_id = %s",
            ("B00000000",),
        )
        conn.commit()

        repo = PostgresCanonicalRepository(conn)
        first = repo.upsert_records(source_code=SOURCE_CODE, records=records)
        second = repo.upsert_records(source_code=SOURCE_CODE, records=records)
        conn.commit()

        assert first.new == 1 and first.updated == 0
        assert second.new == 0 and second.updated == 0

        count = conn.execute(
            """
            select count(*)
            from public.tender_sources
            where source_code = %s and source_tender_id = %s
            """,
            (SOURCE_CODE, source_tender_id),
        ).fetchone()
        assert count is not None and count[0] == 1

        row = conn.execute(
            """
            select t.title, (
              select coalesce(array_agg(c.cpv_code order by c.cpv_code), '{}'::text[])
              from public.tender_cpvs c where c.tender_id = t.id
            ), a.tax_id, a.identity_confidence
            from public.tenders t
            join public.tender_sources ts on ts.tender_id = t.id
            left join public.contracting_authorities a on a.id = t.contracting_authority_id
            where ts.source_code = %s and ts.source_tender_id = %s
            """,
            (SOURCE_CODE, source_tender_id),
        ).fetchone()
        assert row is not None
        assert row[0].startswith("Suministro")
        assert list(row[1]) == ["30192700"]
        assert row[2] == "B00000000"
        assert row[3] == "HIGH"
