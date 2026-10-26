"""Healthcheck mínimo por fuente a partir de ``public.source_sync``.

Semana 6 / Paso 9. No sustituye métricas de producto; responde
«¿cuál fue el último run y quedó bien?» para las fuentes del MVP.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import psycopg

from efilicit_ingestion.pipeline.canonical_repo import SOURCE_PRIORITY

# Fuentes productivas conocidas (mismo orden de prioridad canónica).
KNOWN_SOURCE_CODES: tuple[str, ...] = tuple(SOURCE_PRIORITY.keys())


@dataclass(frozen=True)
class SourceHealthRow:
    source_code: str
    status: str | None
    run_id: str | None
    started_at: datetime | None
    finished_at: datetime | None
    error_message: str | None
    records_seen: int | None
    stale: bool
    """True si no hay success reciente dentro de ``max_age`` (o nunca hubo)."""


def fetch_latest_syncs(
    conn: psycopg.Connection,
    *,
    source_codes: tuple[str, ...] = KNOWN_SOURCE_CODES,
) -> dict[str, SourceHealthRow]:
    """Última fila ``source_sync`` por ``source_code`` (por ``started_at``)."""
    out: dict[str, SourceHealthRow] = {
        code: SourceHealthRow(
            source_code=code,
            status=None,
            run_id=None,
            started_at=None,
            finished_at=None,
            error_message=None,
            records_seen=None,
            stale=True,
        )
        for code in source_codes
    }
    if not source_codes:
        return out

    with conn.cursor() as cur:
        cur.execute(
            """
            select distinct on (source_code)
              source_code,
              status,
              run_id,
              started_at,
              finished_at,
              error_message,
              records_seen
            from public.source_sync
            where source_code = any(%s)
            order by source_code, started_at desc
            """,
            (list(source_codes),),
        )
        for row in cur.fetchall():
            code = str(row[0])
            out[code] = SourceHealthRow(
                source_code=code,
                status=str(row[1]) if row[1] is not None else None,
                run_id=str(row[2]) if row[2] is not None else None,
                started_at=row[3],
                finished_at=row[4],
                error_message=str(row[5]) if row[5] else None,
                records_seen=int(row[6]) if row[6] is not None else None,
                stale=True,  # rellenado en mark_stale
            )
    return out


def mark_stale(
    rows: dict[str, SourceHealthRow],
    *,
    max_age: timedelta,
    now: datetime | None = None,
) -> dict[str, SourceHealthRow]:
    """Marca ``stale`` si no hay ``success`` con ``finished_at`` dentro de ``max_age``."""
    clock = now or datetime.now(timezone.utc)
    updated: dict[str, SourceHealthRow] = {}
    for code, row in rows.items():
        fresh = False
        if row.status == "success" and row.finished_at is not None:
            finished = row.finished_at
            if finished.tzinfo is None:
                finished = finished.replace(tzinfo=timezone.utc)
            fresh = finished >= clock - max_age
        updated[code] = SourceHealthRow(
            source_code=row.source_code,
            status=row.status,
            run_id=row.run_id,
            started_at=row.started_at,
            finished_at=row.finished_at,
            error_message=row.error_message,
            records_seen=row.records_seen,
            stale=not fresh,
        )
    return updated


def format_health_report(rows: dict[str, SourceHealthRow]) -> str:
    lines = ["source_code\tstatus\tstale\tfinished_at\trun_id\trecords_seen\terror"]
    for code in sorted(rows.keys(), key=lambda c: SOURCE_PRIORITY.get(c, 9999)):
        r = rows[code]
        finished = r.finished_at.isoformat() if r.finished_at else "-"
        err = (r.error_message or "-").replace("\t", " ").replace("\n", " ")[:80]
        lines.append(
            f"{r.source_code}\t{r.status or 'never'}\t"
            f"{'yes' if r.stale else 'no'}\t{finished}\t"
            f"{r.run_id or '-'}\t{r.records_seen if r.records_seen is not None else '-'}\t{err}"
        )
    stale_n = sum(1 for r in rows.values() if r.stale)
    lines.append(f"# stale={stale_n}/{len(rows)}")
    return "\n".join(lines)


def exit_code_for(rows: dict[str, SourceHealthRow], *, fail_on_stale: bool) -> int:
    if any(r.status == "failed" for r in rows.values()):
        return 1
    if fail_on_stale and any(r.stale for r in rows.values()):
        return 1
    return 0
