"""Carga opcional de tablas de semillas (remoto sin offer_cases, etc.)."""

from __future__ import annotations

from typing import Any

from efilicit_ingestion.recommendations.postgres import (
    _fetch_optional_rows,
    _public_table_exists,
)


class _FakeCursor:
    def __init__(
        self,
        *,
        exists: bool,
        rows: list[tuple[Any, ...]] | None = None,
    ) -> None:
        self.exists = exists
        self.rows = rows or []
        self.executed: list[tuple[str, tuple[Any, ...]]] = []

    def execute(self, sql: str, params: tuple[Any, ...] = ()) -> None:
        self.executed.append((sql, params))

    def fetchone(self) -> tuple[int] | None:
        return (1,) if self.exists else None

    def fetchall(self) -> list[tuple[Any, ...]]:
        return list(self.rows)


def test_public_table_exists_false() -> None:
    cur = _FakeCursor(exists=False)
    assert _public_table_exists(cur, "offer_cases") is False


def test_fetch_optional_rows_skips_missing_table() -> None:
    cur = _FakeCursor(exists=False, rows=[("t1", "adjudicada")])
    out = _fetch_optional_rows(
        cur,
        table_name="offer_cases",
        sql="select tender_id::text, stage from public.offer_cases",
    )
    assert out == []
    assert len(cur.executed) == 1  # solo information_schema


def test_fetch_optional_rows_reads_when_present() -> None:
    cur = _FakeCursor(exists=True, rows=[("t1", "propia")])
    out = _fetch_optional_rows(
        cur,
        table_name="favorites_common",
        sql="select tender_id::text, kind from public.favorites_common",
    )
    assert out == [("t1", "propia")]
    assert len(cur.executed) == 2
