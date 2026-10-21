"""ADR 015: fuente ganadora — secundaria no pisa; promoción por ranking."""

from __future__ import annotations

from decimal import Decimal

import psycopg
import pytest

from efilicit_ingestion.models import SourceRecord
from efilicit_ingestion.pipeline.canonical_repo import (
    InMemoryCanonicalRepository,
    PostgresCanonicalRepository,
    beats_canonical_owner,
    source_priority,
)
from efilicit_ingestion.pipeline.matching import REVIEW_AUTO, match_records
from efilicit_ingestion.pipeline.postgres import connect, default_database_url


def _record(
    *,
    source_record_id: str,
    title: str,
    tax_id: str,
    expediente: str,
    cpv_code: str | None = "30192700",
    deadline_at: str | None = "2026-12-31T12:00:00+00:00",
) -> SourceRecord:
    source_tender_id = f"{tax_id}:{expediente}"
    return SourceRecord(
        source_record_id=source_record_id,
        payload={
            "contract_folder_id": expediente,
            "canonical": {
                "source_tender_id": source_tender_id,
                "title": title,
                "cpv_codes": [cpv_code] if cpv_code else [],
                "estimated_value": Decimal("1000.00"),
                "publication_date": "2024-06-01",
                "deadline_at": deadline_at,
                "status": "publicada",
                "authority": {
                    "tax_id": tax_id,
                    "name": "Ayuntamiento de Prueba",
                    "country_code": "ES",
                    "tax_id_country": "ES",
                },
            },
        },
    )


def test_source_priority_placsp_beats_euskadi() -> None:
    assert source_priority("placsp") < source_priority("euskadi")
    assert beats_canonical_owner("placsp", "euskadi")
    assert not beats_canonical_owner("euskadi", "placsp")
    assert not beats_canonical_owner("catalunya", "placsp")


def test_auto_secondary_does_not_overwrite_owner_fields() -> None:
    repo = InMemoryCanonicalRepository()
    placsp = _record(
        source_record_id="p1",
        title="Titulo PLACSP rico",
        tax_id="P2800000A",
        expediente="EXP-OWN-1",
        cpv_code="48000000",
        deadline_at="2026-06-01T10:00:00+00:00",
    )
    repo.upsert_records(source_code="placsp", records=[placsp])
    tender_id = next(iter(repo.tenders))
    assert repo.tenders[tender_id]["canonical_source_code"] == "placsp"
    assert repo.tenders[tender_id]["cpv_codes"] == ["48000000"]
    assert repo.tenders[tender_id]["title"] == "Titulo PLACSP rico"

    euskadi = _record(
        source_record_id="e1",
        title="Titulo Euskadi pobre",
        tax_id="P2800000A",
        expediente="EXP-OWN-1",
        cpv_code=None,
        deadline_at=None,
    )
    # source_tender_id for euskadi without matching canonical id style — use same
    # tax:exp so match finds it; override source_record_id path via payload.
    euskadi.payload["canonical"]["source_tender_id"] = "910001"
    euskadi.payload["canonical"]["cpv_codes"] = []
    euskadi.payload["canonical"]["deadline_at"] = None
    annotated = match_records([euskadi], source_code="euskadi", lookup=repo)
    assert annotated[0].payload["match"]["review_status"] == REVIEW_AUTO

    repo.upsert_records(source_code="euskadi", records=annotated)
    assert len(repo.tenders) == 1
    row = repo.tenders[tender_id]
    assert row["canonical_source_code"] == "placsp"
    assert row["title"] == "Titulo PLACSP rico"
    assert row["cpv_codes"] == ["48000000"]
    assert row["deadline_at"] == "2026-06-01T10:00:00+00:00"
    assert repo.tender_sources[("euskadi", "910001")]["tender_id"] == tender_id


def test_promotion_replaces_entire_tender_when_higher_priority_arrives() -> None:
    repo = InMemoryCanonicalRepository()
    euskadi = _record(
        source_record_id="e1",
        title="Solo Euskadi",
        tax_id="P2800000B",
        expediente="EXP-PROM-1",
        cpv_code=None,
        deadline_at=None,
    )
    euskadi.payload["canonical"]["source_tender_id"] = "920001"
    euskadi.payload["canonical"]["cpv_codes"] = []
    repo.upsert_records(source_code="euskadi", records=[euskadi])
    tender_id = next(iter(repo.tenders))
    assert repo.tenders[tender_id]["canonical_source_code"] == "euskadi"
    assert repo.tenders[tender_id]["title"] == "Solo Euskadi"

    placsp = _record(
        source_record_id="p1",
        title="PLACSP completo",
        tax_id="P2800000B",
        expediente="EXP-PROM-1",
        cpv_code="72000000",
    )
    annotated = match_records([placsp], source_code="placsp", lookup=repo)
    assert annotated[0].payload["match"]["review_status"] == REVIEW_AUTO
    repo.upsert_records(source_code="placsp", records=annotated)

    row = repo.tenders[tender_id]
    assert row["canonical_source_code"] == "placsp"
    assert row["title"] == "PLACSP completo"
    assert row["cpv_codes"] == ["72000000"]
    assert len(repo.tender_sources) == 2


def test_owner_reingest_still_updates_content() -> None:
    repo = InMemoryCanonicalRepository()
    first = _record(
        source_record_id="p1",
        title="Antes",
        tax_id="P2800000C",
        expediente="EXP-RE-1",
    )
    repo.upsert_records(source_code="placsp", records=[first])
    tender_id = next(iter(repo.tenders))

    changed = _record(
        source_record_id="p1",
        title="Despues",
        tax_id="P2800000C",
        expediente="EXP-RE-1",
        cpv_code="30192700",
    )
    stats = repo.upsert_records(source_code="placsp", records=[changed])
    assert stats.updated == 1
    assert repo.tenders[tender_id]["title"] == "Despues"
    assert repo.tenders[tender_id]["canonical_source_code"] == "placsp"


def test_secondary_reingest_does_not_update_tender() -> None:
    repo = InMemoryCanonicalRepository()
    placsp = _record(
        source_record_id="p1",
        title="Dueña",
        tax_id="P2800000D",
        expediente="EXP-SEC-1",
    )
    repo.upsert_records(source_code="placsp", records=[placsp])
    tender_id = next(iter(repo.tenders))

    cat = _record(
        source_record_id="c1",
        title="Catalunya secundaria",
        tax_id="P2800000D",
        expediente="EXP-SEC-1",
    )
    annotated = match_records([cat], source_code="catalunya", lookup=repo)
    repo.upsert_records(source_code="catalunya", records=annotated)
    assert repo.tenders[tender_id]["title"] == "Dueña"

    cat.payload["canonical"]["title"] = "Catalunya intenta pisar"
    stats = repo.upsert_records(source_code="catalunya", records=[cat])
    assert stats.updated == 0
    assert repo.tenders[tender_id]["title"] == "Dueña"
    assert repo.tenders[tender_id]["canonical_source_code"] == "placsp"


def _db_available() -> bool:
    try:
        with psycopg.connect(default_database_url(), connect_timeout=2) as conn:
            conn.execute("select 1")
        return True
    except psycopg.Error:
        return False


@pytest.mark.skipif(not _db_available(), reason="Local Supabase Postgres not reachable")
def test_postgres_secondary_does_not_overwrite_owner() -> None:
    tax_id = "P8888000Z"
    expediente = "EXP-PG-OWN-1"
    placsp_sid = f"{tax_id}:{expediente}"

    with connect() as conn:
        conn.execute(
            """
            delete from public.tenders t
            using public.tender_sources ts
            where ts.tender_id = t.id
              and ts.source_tender_id in (%s, %s)
            """,
            (placsp_sid, "930001"),
        )
        conn.execute(
            "delete from public.contracting_authorities where tax_id = %s",
            (tax_id,),
        )
        conn.commit()

        repo = PostgresCanonicalRepository(conn)
        placsp = _record(
            source_record_id="pg-p1",
            title="PG PLACSP",
            tax_id=tax_id,
            expediente=expediente,
            cpv_code="48000000",
        )
        repo.upsert_records(source_code="placsp", records=[placsp])

        euskadi = _record(
            source_record_id="pg-e1",
            title="PG Euskadi",
            tax_id=tax_id,
            expediente=expediente,
            cpv_code=None,
        )
        euskadi.payload["canonical"]["source_tender_id"] = "930001"
        euskadi.payload["canonical"]["cpv_codes"] = []
        annotated = match_records([euskadi], source_code="euskadi", lookup=repo)
        assert annotated[0].payload["match"]["review_status"] == REVIEW_AUTO
        repo.upsert_records(source_code="euskadi", records=annotated)
        conn.commit()

        row = conn.execute(
            """
            select t.title, (
              select coalesce(array_agg(c.cpv_code order by c.cpv_code), '{}'::text[])
              from public.tender_cpvs c where c.tender_id = t.id
            ), t.canonical_source_code,
                   (
                     select count(*) from public.tender_sources ts2
                     where ts2.tender_id = t.id
                   ) as link_count
            from public.tenders t
            join public.tender_sources ts on ts.tender_id = t.id
            where ts.source_code = 'placsp' and ts.source_tender_id = %s
            """,
            (placsp_sid,),
        ).fetchone()
        assert row is not None
        assert row[0] == "PG PLACSP"
        assert list(row[1]) == ["48000000"]
        assert row[2] == "placsp"
        assert row[3] == 2
