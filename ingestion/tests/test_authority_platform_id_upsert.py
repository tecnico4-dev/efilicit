"""Upsert de organismos por platform_id cuando no hay NIF (ADR 014).

Catalunya SODA no trae tax_id; sin esta clave cada re-ingesta creaba filas
huérfanas en contracting_authorities.
"""

from __future__ import annotations

from datetime import datetime, timezone

import psycopg
import pytest

from efilicit_ingestion.models import SourceRecord
from efilicit_ingestion.pipeline.canonical_repo import (
    InMemoryCanonicalRepository,
    PostgresCanonicalRepository,
    _authority_cache_key,
)
from efilicit_ingestion.pipeline.postgres import connect, default_database_url

DIR3_A = "L01000001"
DIR3_B = "L01000003"


def _record(
    *,
    source_record_id: str,
    name: str,
    platform_id: str | None,
    tax_id: str | None = None,
) -> SourceRecord:
    return SourceRecord(
        source_record_id=source_record_id,
        recorded_at=datetime(2026, 9, 10, tzinfo=timezone.utc),
        payload={
            "canonical": {
                "title": f"Tender {source_record_id}",
                "status": "publicada",
                "source_tender_id": source_record_id,
                "authority": {
                    "name": name,
                    "name_normalized": name.lower(),
                    "tax_id": tax_id,
                    "tax_id_country": "ES",
                    "platform_id": platform_id,
                    "identity_confidence": "MEDIUM" if platform_id and not tax_id else (
                        "HIGH" if tax_id else "LOW"
                    ),
                },
            }
        },
    )


def test_authority_cache_key_prefers_tax_id_over_platform() -> None:
    assert _authority_cache_key(
        {"tax_id": "P1234567A", "tax_id_country": "ES", "platform_id": "L01"}
    ) == "tax:ES:P1234567A"
    assert _authority_cache_key(
        {"tax_id": None, "tax_id_country": "ES", "platform_id": DIR3_A}
    ) == f"plat:ES:{DIR3_A}"
    assert _authority_cache_key({"name": "Solo nombre"}) is None


def test_postgres_authority_cache_skips_repeat_sql_in_same_run() -> None:
    """Misma autoridad estable → un solo INSERT…ON CONFLICT por corrida."""

    class _Result:
        def __init__(self, row: tuple[str, ...]) -> None:
            self._row = row

        def fetchone(self) -> tuple[str, ...]:
            return self._row

    class _Conn:
        def __init__(self) -> None:
            self.authority_inserts = 0

        def execute(self, sql: str, params: object = None) -> _Result:
            if "insert into public.contracting_authorities" in sql:
                self.authority_inserts += 1
                return _Result(("auth-cached-1",))
            if "select tender_id" in sql:
                return _Result(())  # type: ignore[arg-type]
            if "insert into public.tenders" in sql:
                return _Result(("tender-1",))
            if "insert into public.tender_sources" in sql:
                return _Result(("ts-1",))
            if "insert into public.tender_cpvs" in sql or "delete from public.tender_cpvs" in sql:
                return _Result(())  # type: ignore[arg-type]
            if "select canonical_source_code" in sql or "select 1 from public.tenders" in sql:
                return _Result(())  # type: ignore[arg-type]
            return _Result(())  # type: ignore[arg-type]

    conn = _Conn()
    repo = PostgresCanonicalRepository(conn)  # type: ignore[arg-type]
    r1 = _record(source_record_id="cache-1", name="Ajuntament A", platform_id=DIR3_A)
    r2 = _record(source_record_id="cache-2", name="Ajuntament A", platform_id=DIR3_A)

    # El mock no implementa el upsert completo de tenders; ejercitamos solo
    # _upsert_authority vía dos llamadas consecutivas.
    id1 = repo._upsert_authority(r1.payload["canonical"]["authority"])
    id2 = repo._upsert_authority(r2.payload["canonical"]["authority"])
    assert id1 == id2 == "auth-cached-1"
    assert conn.authority_inserts == 1


def test_inmemory_same_platform_id_reuses_authority_across_tenders_and_reingest() -> None:
    repo = InMemoryCanonicalRepository()
    r1 = _record(source_record_id="c-1", name="Ajuntament A", platform_id=DIR3_A)
    r2 = _record(source_record_id="c-2", name="Ajuntament A", platform_id=DIR3_A)
    r3 = _record(source_record_id="c-3", name="Diputacio B", platform_id=DIR3_B)

    first = repo.upsert_records(source_code="catalunya", records=[r1, r2, r3])
    assert first.new == 3
    assert len(repo.authorities) == 2

    ids_first = {a["id"] for a in repo.authorities.values()}
    second = repo.upsert_records(source_code="catalunya", records=[r1, r2, r3])
    assert second.new == 0 and second.updated == 0
    assert len(repo.authorities) == 2
    assert {a["id"] for a in repo.authorities.values()} == ids_first


def test_inmemory_tax_id_still_preferred_over_platform_id() -> None:
    repo = InMemoryCanonicalRepository()
    with_nif = _record(
        source_record_id="p-1",
        name="Ayuntamiento",
        platform_id="PLAT-1",
        tax_id="P1234567A",
    )
    again = _record(
        source_record_id="p-2",
        name="Ayuntamiento Renamed",
        platform_id="PLAT-OTHER",
        tax_id="P1234567A",
    )
    repo.upsert_records(source_code="placsp", records=[with_nif, again])
    assert len(repo.authorities) == 1
    only = next(iter(repo.authorities.values()))
    assert only["tax_id"] == "P1234567A"
    assert only["name"] == "Ayuntamiento Renamed"


def _db_available() -> bool:
    try:
        with psycopg.connect(default_database_url(), connect_timeout=2) as conn:
            conn.execute("select 1")
        return True
    except psycopg.Error:
        return False


@pytest.mark.skipif(not _db_available(), reason="Local Supabase Postgres not reachable")
def test_postgres_platform_id_upsert_does_not_orphan_authorities() -> None:
    records = [
        _record(source_record_id="pg-c-1", name="Ajuntament PG A", platform_id=DIR3_A),
        _record(source_record_id="pg-c-2", name="Ajuntament PG A", platform_id=DIR3_A),
    ]
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
                ("catalunya", source_tender_id),
            )
        conn.execute(
            """
            delete from public.contracting_authorities
            where platform_id = %s and tax_id is null
            """,
            (DIR3_A,),
        )
        conn.commit()

        repo = PostgresCanonicalRepository(conn)
        first = repo.upsert_records(source_code="catalunya", records=records)
        second = repo.upsert_records(source_code="catalunya", records=records)
        conn.commit()

        assert first.new == 2 and first.updated == 0
        assert second.new == 0 and second.updated == 0

        auth_count = conn.execute(
            """
            select count(*)
            from public.contracting_authorities
            where platform_id = %s and tax_id is null
            """,
            (DIR3_A,),
        ).fetchone()
        assert auth_count is not None and auth_count[0] == 1

        tender_auth_ids = conn.execute(
            """
            select distinct t.contracting_authority_id
            from public.tenders t
            join public.tender_sources ts on ts.tender_id = t.id
            where ts.source_code = %s and ts.source_tender_id = any(%s)
            """,
            ("catalunya", ids),
        ).fetchall()
        assert len(tender_auth_ids) == 1
