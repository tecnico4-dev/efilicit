"""Tests Semana 2 Paso 7: upsert canónico + idempotencia."""

from __future__ import annotations

from pathlib import Path

import psycopg
import pytest

from efilicit_ingestion.connectors.placsp.parser import parse_placsp_artifact
from efilicit_ingestion.models import RemoteArtifact
from efilicit_ingestion.pipeline import stages
from efilicit_ingestion.pipeline.canonical_repo import (
    InMemoryCanonicalRepository,
    PostgresCanonicalRepository,
)
from efilicit_ingestion.pipeline.postgres import connect, default_database_url

FIXTURES = Path(__file__).parent / "fixtures" / "placsp"
SOURCE_CODE = "placsp"


def _normalized_records(fixture_name: str = "valid_single_entry.atom"):
    raw = (FIXTURES / fixture_name).read_bytes()
    artifact = RemoteArtifact(
        artifact_key=fixture_name,
        source_url="https://example.invalid/fixture",
        content_type="application/atom+xml",
    )
    records = list(parse_placsp_artifact(raw, artifact))
    records = stages.normalize(records)
    return stages.resolve_identity(records)


def test_inmemory_upsert_is_idempotent_on_source_tender_id() -> None:
    repo = InMemoryCanonicalRepository()
    records = _normalized_records()

    first = repo.upsert_records(source_code=SOURCE_CODE, records=records)
    second = repo.upsert_records(source_code=SOURCE_CODE, records=records)

    assert first.seen == 1 and first.new == 1 and first.updated == 0
    assert second.seen == 1 and second.new == 0 and second.updated == 1
    assert len(repo.tenders) == 1
    assert len(repo.tender_sources) == 1
    assert len(repo.events) == 2
    assert repo.events[0]["event_type"] == "published"
    assert repo.events[1]["event_type"] == "updated"

    tender = next(iter(repo.tenders.values()))
    assert tender["title"].startswith("Suministro")
    assert tender["cpv_code"] == "30192700"
    assert tender["estimated_value"] is not None


def test_stages_upsert_without_repo_keeps_legacy_counters() -> None:
    records = _normalized_records()
    seen, new, updated = stages.upsert(records, source_code=SOURCE_CODE)
    assert (seen, new, updated) == (1, 1, 0)


def _db_available() -> bool:
    try:
        with psycopg.connect(default_database_url(), connect_timeout=2) as conn:
            conn.execute("select 1")
        return True
    except psycopg.Error:
        return False


@pytest.mark.skipif(not _db_available(), reason="Local Supabase Postgres not reachable")
def test_postgres_upsert_populates_canonical_and_does_not_duplicate() -> None:
    records = _normalized_records()
    source_tender_id = records[0].payload["canonical"]["source_tender_id"]

    with connect() as conn:
        # Clean previous fixture rows for this source_tender_id.
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
        assert second.new == 0 and second.updated == 1

        tender_count = conn.execute(
            """
            select count(*)
            from public.tender_sources
            where source_code = %s and source_tender_id = %s
            """,
            (SOURCE_CODE, source_tender_id),
        ).fetchone()
        assert tender_count is not None and tender_count[0] == 1

        row = conn.execute(
            """
            select t.title, t.status, t.cpv_code, t.estimated_value, a.tax_id, a.identity_confidence
            from public.tenders t
            join public.tender_sources ts on ts.tender_id = t.id
            left join public.contracting_authorities a on a.id = t.contracting_authority_id
            where ts.source_code = %s and ts.source_tender_id = %s
            """,
            (SOURCE_CODE, source_tender_id),
        ).fetchone()
        assert row is not None
        assert row[0].startswith("Suministro")
        assert row[1] == "published"
        assert row[2] == "30192700"
        assert row[3] is not None
        assert row[4] == "B00000000"
        assert row[5] == "HIGH"

        events = conn.execute(
            """
            select event_type
            from public.tender_events e
            join public.tender_sources ts on ts.tender_id = e.tender_id
            where ts.source_code = %s and ts.source_tender_id = %s
            order by e.created_at
            """,
            (SOURCE_CODE, source_tender_id),
        ).fetchall()
        assert [e[0] for e in events] == ["published", "updated"]

        docs = conn.execute(
            """
            select count(*)
            from public.documents d
            join public.tender_sources ts on ts.tender_id = d.tender_id
            where ts.source_code = %s and ts.source_tender_id = %s
            """,
            (SOURCE_CODE, source_tender_id),
        ).fetchone()
        assert docs is not None and docs[0] == 1
