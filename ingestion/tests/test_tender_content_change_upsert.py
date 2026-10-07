"""Re-ingesta: eventos y tenders.updated_at solo si cambia el contenido canónico."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone

import psycopg
import pytest

from efilicit_ingestion.models import SourceRecord
from efilicit_ingestion.pipeline.canonical_repo import (
    InMemoryCanonicalRepository,
    PostgresCanonicalRepository,
)
from efilicit_ingestion.pipeline.postgres import connect, default_database_url


def _record(
    *,
    source_record_id: str = "chg-1",
    title: str = "Suministro fixture",
    status: str = "published",
    deadline_at: str | None = "2026-09-30T12:00:00+00:00",
) -> SourceRecord:
    return SourceRecord(
        source_record_id=source_record_id,
        recorded_at=datetime(2026, 9, 1, tzinfo=timezone.utc),
        payload={
            "canonical": {
                "title": title,
                "description": "desc",
                "status": status,
                "procedure_type": None,
                "contract_type": "1",
                "estimated_value": "1000.00",
                "currency": "EUR",
                "cpv_code": "30192700",
                "publication_date": "2026-09-01",
                "deadline_at": deadline_at,
                "source_tender_id": source_record_id,
                "source_url": "https://example.invalid/t/1",
                "authority": {
                    "name": "Ayuntamiento Fixture",
                    "name_normalized": "ayuntamiento fixture",
                    "tax_id": "B76543210",
                    "tax_id_country": "ES",
                    "platform_id": None,
                    "identity_confidence": "HIGH",
                },
            }
        },
    )


def test_inmemory_identical_reingest_skips_event_and_updated_counter() -> None:
    repo = InMemoryCanonicalRepository()
    record = _record()
    first = repo.upsert_records(source_code="placsp", records=[record])
    second = repo.upsert_records(source_code="placsp", records=[record])

    assert first.new == 1 and first.updated == 0
    assert second.new == 0 and second.updated == 0
    assert len(repo.events) == 1
    assert repo.events[0]["event_type"] == "published"
    assert repo.tender_sources[("placsp", "chg-1")].get("last_seen_at") is not None


def test_inmemory_real_change_emits_updated_event() -> None:
    repo = InMemoryCanonicalRepository()
    first_rec = _record(status="published")
    repo.upsert_records(source_code="placsp", records=[first_rec])

    changed = deepcopy(first_rec)
    changed.payload["canonical"]["status"] = "awarded"
    second = repo.upsert_records(source_code="placsp", records=[changed])

    assert second.updated == 1
    assert [e["event_type"] for e in repo.events] == ["published", "updated"]
    tender = next(iter(repo.tenders.values()))
    assert tender["status"] == "awarded"


def _db_available() -> bool:
    try:
        with psycopg.connect(default_database_url(), connect_timeout=2) as conn:
            conn.execute("select 1")
        return True
    except psycopg.Error:
        return False


@pytest.mark.skipif(not _db_available(), reason="Local Supabase Postgres not reachable")
def test_postgres_identical_reingest_keeps_updated_at_and_last_seen() -> None:
    record = _record(source_record_id="pg-chg-1")
    source_tender_id = "pg-chg-1"

    with connect() as conn:
        conn.execute(
            """
            delete from public.tenders t
            using public.tender_sources ts
            where ts.tender_id = t.id
              and ts.source_code = %s
              and ts.source_tender_id = %s
            """,
            ("placsp", source_tender_id),
        )
        conn.execute(
            "delete from public.contracting_authorities where tax_id = %s",
            ("B76543210",),
        )
        conn.commit()

        repo = PostgresCanonicalRepository(conn)
        first = repo.upsert_records(source_code="placsp", records=[record])
        row1 = conn.execute(
            """
            select t.updated_at, ts.last_seen_at
            from public.tenders t
            join public.tender_sources ts on ts.tender_id = t.id
            where ts.source_code = %s and ts.source_tender_id = %s
            """,
            ("placsp", source_tender_id),
        ).fetchone()
        assert row1 is not None
        updated_at_1, last_seen_1 = row1

        second = repo.upsert_records(source_code="placsp", records=[record])
        conn.commit()

        assert first.new == 1 and first.updated == 0
        assert second.new == 0 and second.updated == 0

        row2 = conn.execute(
            """
            select t.updated_at, ts.last_seen_at
            from public.tenders t
            join public.tender_sources ts on ts.tender_id = t.id
            where ts.source_code = %s and ts.source_tender_id = %s
            """,
            ("placsp", source_tender_id),
        ).fetchone()
        assert row2 is not None
        updated_at_2, last_seen_2 = row2
        assert updated_at_2 == updated_at_1
        assert last_seen_2 >= last_seen_1

        events = conn.execute(
            """
            select event_type
            from public.tender_events e
            join public.tender_sources ts on ts.tender_id = e.tender_id
            where ts.source_code = %s and ts.source_tender_id = %s
            order by e.created_at
            """,
            ("placsp", source_tender_id),
        ).fetchall()
        assert [e[0] for e in events] == ["published"]


@pytest.mark.skipif(not _db_available(), reason="Local Supabase Postgres not reachable")
def test_postgres_status_change_bumps_updated_at_and_event() -> None:
    record = _record(source_record_id="pg-chg-2", status="published")
    source_tender_id = "pg-chg-2"

    with connect() as conn:
        conn.execute(
            """
            delete from public.tenders t
            using public.tender_sources ts
            where ts.tender_id = t.id
              and ts.source_code = %s
              and ts.source_tender_id = %s
            """,
            ("placsp", source_tender_id),
        )
        conn.commit()

        repo = PostgresCanonicalRepository(conn)
        repo.upsert_records(source_code="placsp", records=[record])
        before = conn.execute(
            """
            select t.updated_at
            from public.tenders t
            join public.tender_sources ts on ts.tender_id = t.id
            where ts.source_code = %s and ts.source_tender_id = %s
            """,
            ("placsp", source_tender_id),
        ).fetchone()
        assert before is not None

        changed = deepcopy(record)
        changed.payload["canonical"]["status"] = "awarded"
        stats = repo.upsert_records(source_code="placsp", records=[changed])
        conn.commit()

        assert stats.updated == 1
        after = conn.execute(
            """
            select t.updated_at, t.status
            from public.tenders t
            join public.tender_sources ts on ts.tender_id = t.id
            where ts.source_code = %s and ts.source_tender_id = %s
            """,
            ("placsp", source_tender_id),
        ).fetchone()
        assert after is not None
        assert after[0] >= before[0]
        assert after[1] == "awarded"

        events = conn.execute(
            """
            select event_type
            from public.tender_events e
            join public.tender_sources ts on ts.tender_id = e.tender_id
            where ts.source_code = %s and ts.source_tender_id = %s
            order by e.created_at
            """,
            ("placsp", source_tender_id),
        ).fetchall()
        assert [e[0] for e in events] == ["published", "updated"]
