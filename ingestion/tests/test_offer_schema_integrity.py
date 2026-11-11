"""Integridad Mis licitaciones — bloques A/B (ADR 027 / 028).

Solo Postgres local (Supabase Studio). Skip en CI sin DB (ADR 004).
Cada test abre transacción y hace ROLLBACK: no deja filas ni toca remoto.
"""

from __future__ import annotations

import uuid

import psycopg
import pytest
from psycopg import errors as pg_errors

from efilicit_ingestion.pipeline.postgres import default_database_url


def _db_available() -> bool:
    try:
        with psycopg.connect(default_database_url(), connect_timeout=2) as conn:
            conn.execute("select 1")
        return True
    except psycopg.Error:
        return False


pytestmark = pytest.mark.skipif(
    not _db_available(),
    reason="Local Supabase Postgres not reachable",
)


def _require_offer_schema(conn: psycopg.Connection) -> None:
    n = conn.execute(
        """
        select count(*)::int
        from information_schema.tables
        where table_schema = 'public'
          and table_name = 'offer_cases'
        """
    ).fetchone()
    if not n or n[0] == 0:
        pytest.skip("public.offer_cases ausente — aplica migraciones locales ADR 026+")


def _insert_tender(conn: psycopg.Connection, *, title: str) -> uuid.UUID:
    row = conn.execute(
        """
        insert into public.tenders (title, canonical_source_code)
        values (%s, 'test_offer_integrity')
        returning id
        """,
        (title,),
    ).fetchone()
    assert row is not None
    return row[0]


def _insert_offer_case(conn: psycopg.Connection, tender_id: uuid.UUID) -> uuid.UUID:
    row = conn.execute(
        """
        insert into public.offer_cases (tender_id, stage)
        values (%s, 'interes')
        returning id
        """,
        (tender_id,),
    ).fetchone()
    assert row is not None
    return row[0]


def _insert_requirement(
    conn: psycopg.Connection,
    offer_case_id: uuid.UUID,
    *,
    title: str = "Requisito test",
) -> uuid.UUID:
    row = conn.execute(
        """
        insert into public.offer_requirements (offer_case_id, title)
        values (%s, %s)
        returning id
        """,
        (offer_case_id, title),
    ).fetchone()
    assert row is not None
    return row[0]


def _insert_deliverable(
    conn: psycopg.Connection,
    offer_case_id: uuid.UUID,
    *,
    title: str = "Entregable test",
) -> uuid.UUID:
    row = conn.execute(
        """
        insert into public.offer_deliverables (offer_case_id, title)
        values (%s, %s)
        returning id
        """,
        (offer_case_id, title),
    ).fetchone()
    assert row is not None
    return row[0]


# ---------------------------------------------------------------------------
# Bloque A — is_app_user
# ---------------------------------------------------------------------------


def test_block_a_is_app_user_function_exists() -> None:
    with psycopg.connect(default_database_url()) as conn:
        _require_offer_schema(conn)
        row = conn.execute(
            """
            select p.proname, pg_get_function_result(p.oid)
            from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public'
              and p.proname = 'is_app_user'
            """
        ).fetchone()
        assert row is not None, "public.is_app_user() debe existir (ADR 027)"
        assert "boolean" in (row[1] or "").lower()


def test_block_a_is_app_user_invocable() -> None:
    with psycopg.connect(default_database_url()) as conn:
        _require_offer_schema(conn)
        # Sin JWT de Auth, auth.uid() es null → false; lo importante es que no falle.
        val = conn.execute("select public.is_app_user()").fetchone()
        assert val is not None
        assert val[0] is False or val[0] is True


# ---------------------------------------------------------------------------
# Bloque B — RESTRICT tender, evidencias, FK compuestas
# ---------------------------------------------------------------------------


def test_block_b_tender_with_offer_case_is_not_deletable() -> None:
    with psycopg.connect(default_database_url()) as conn:
        _require_offer_schema(conn)
        before = conn.execute("select count(*)::int from public.offer_cases").fetchone()
        assert before is not None
        conn.execute("begin")
        try:
            tender_id = _insert_tender(conn, title="Integrity RESTRICT tender")
            _insert_offer_case(conn, tender_id)

            conn.execute("savepoint sp_del")
            with pytest.raises(pg_errors.ForeignKeyViolation):
                conn.execute("delete from public.tenders where id = %s", (tender_id,))
            conn.execute("rollback to savepoint sp_del")

            still = conn.execute(
                "select count(*)::int from public.offer_cases where tender_id = %s",
                (tender_id,),
            ).fetchone()
            assert still is not None and still[0] == 1
        finally:
            conn.execute("rollback")

        final = conn.execute("select count(*)::int from public.offer_cases").fetchone()
        assert final is not None
        assert final[0] == before[0]


def test_block_b_evidence_kind_must_match_payload() -> None:
    with psycopg.connect(default_database_url()) as conn:
        _require_offer_schema(conn)
        conn.execute("begin")
        try:
            tender_id = _insert_tender(conn, title="Integrity evidence CHECK")
            case_id = _insert_offer_case(conn, tender_id)
            req_id = _insert_requirement(conn, case_id)

            conn.execute("savepoint sp_bad_kind")
            with pytest.raises(pg_errors.CheckViolation):
                conn.execute(
                    """
                    insert into public.offer_requirement_evidence (
                      requirement_id, evidence_kind, notes
                    ) values (%s, 'document', 'solo notas')
                    """,
                    (req_id,),
                )
            conn.execute("rollback to savepoint sp_bad_kind")

            # kind=url con URL válida → OK
            conn.execute(
                """
                insert into public.offer_requirement_evidence (
                  requirement_id, evidence_kind, url
                ) values (%s, 'url', 'https://example.invalid/doc')
                """,
                (req_id,),
            )
        finally:
            conn.execute("rollback")


def test_block_b_company_document_in_use_is_not_deletable() -> None:
    with psycopg.connect(default_database_url()) as conn:
        _require_offer_schema(conn)
        conn.execute("begin")
        try:
            tender_id = _insert_tender(conn, title="Integrity doc RESTRICT")
            case_id = _insert_offer_case(conn, tender_id)
            req_id = _insert_requirement(conn, case_id)

            doc_id = conn.execute(
                """
                insert into public.company_documents (title, doc_type)
                values ('Cert test', 'otro')
                returning id
                """
            ).fetchone()
            assert doc_id is not None

            conn.execute(
                """
                insert into public.offer_requirement_evidence (
                  requirement_id, evidence_kind, document_id
                ) values (%s, 'document', %s)
                """,
                (req_id, doc_id[0]),
            )

            conn.execute("savepoint sp_doc")
            with pytest.raises(pg_errors.ForeignKeyViolation):
                conn.execute(
                    "delete from public.company_documents where id = %s",
                    (doc_id[0],),
                )
            conn.execute("rollback to savepoint sp_doc")
        finally:
            conn.execute("rollback")


def test_block_b_cannot_link_requirement_to_deliverable_of_other_case() -> None:
    with psycopg.connect(default_database_url()) as conn:
        _require_offer_schema(conn)
        conn.execute("begin")
        try:
            t_a = _insert_tender(conn, title="Integrity case A")
            t_b = _insert_tender(conn, title="Integrity case B")
            case_a = _insert_offer_case(conn, t_a)
            case_b = _insert_offer_case(conn, t_b)
            req_a = _insert_requirement(conn, case_a, title="Req A")
            del_b = _insert_deliverable(conn, case_b, title="Del B")

            conn.execute("savepoint sp_cross")
            with pytest.raises(pg_errors.ForeignKeyViolation):
                conn.execute(
                    """
                    insert into public.offer_requirement_deliverables (
                      requirement_id, deliverable_id, offer_case_id
                    ) values (%s, %s, %s)
                    """,
                    (req_a, del_b, case_a),
                )
            conn.execute("rollback to savepoint sp_cross")

            # Vínculo coherente (mismo caso) → OK
            del_a = _insert_deliverable(conn, case_a, title="Del A")
            conn.execute(
                """
                insert into public.offer_requirement_deliverables (
                  requirement_id, deliverable_id, offer_case_id
                ) values (%s, %s, %s)
                """,
                (req_a, del_a, case_a),
            )
        finally:
            conn.execute("rollback")


def test_block_b_deliverable_parent_must_same_case() -> None:
    with psycopg.connect(default_database_url()) as conn:
        _require_offer_schema(conn)
        conn.execute("begin")
        try:
            t_a = _insert_tender(conn, title="Integrity parent A")
            t_b = _insert_tender(conn, title="Integrity parent B")
            case_a = _insert_offer_case(conn, t_a)
            case_b = _insert_offer_case(conn, t_b)
            parent_b = _insert_deliverable(conn, case_b, title="Parent B")

            conn.execute("savepoint sp_parent")
            with pytest.raises(pg_errors.ForeignKeyViolation):
                conn.execute(
                    """
                    insert into public.offer_deliverables (
                      offer_case_id, parent_id, title
                    ) values (%s, %s, 'Child A cross')
                    """,
                    (case_a, parent_b),
                )
            conn.execute("rollback to savepoint sp_parent")
        finally:
            conn.execute("rollback")
