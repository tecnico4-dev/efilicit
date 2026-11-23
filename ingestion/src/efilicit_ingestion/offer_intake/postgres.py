"""Cola ``offer_case_intake`` y volcado idempotente a ``offer_*`` (ADR 035)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from uuid import UUID

import psycopg
from psycopg.types.json import Jsonb

from efilicit_ingestion.offer_intake.plan import IntakePlan

PLACSP_SOURCE_CODES = ("placsp", "placsp_agregadas", "placsp_menores")
STALE_PROCESSING_MINUTES = 30
ERROR_MAX = 500


@dataclass(frozen=True, slots=True)
class IntakeJob:
    id: UUID
    offer_case_id: UUID
    attempts: int


@dataclass(frozen=True, slots=True)
class CaseSource:
    tender_id: UUID
    target_lots: Any
    source_code: str | None
    storage_path: str | None


@dataclass(frozen=True, slots=True)
class PendingDownload:
    pliego_id: UUID
    url: str


@dataclass
class ApplyStats:
    pliegos: int = 0
    requirements: int = 0
    deliverables: int = 0
    milestones: int = 0

    @property
    def total(self) -> int:
        return self.pliegos + self.requirements + self.deliverables + self.milestones


def enqueue(conn: psycopg.Connection, offer_case_id: UUID | str) -> UUID | None:
    """Encola si no hay trabajo abierto; devuelve el id nuevo o ``None``."""
    row = conn.execute(
        """
        insert into public.offer_case_intake (offer_case_id)
        values (%s)
        on conflict (offer_case_id) where status in ('pending', 'processing') do nothing
        returning id
        """,
        (offer_case_id,),
    ).fetchone()
    return row[0] if row else None


def claim_jobs(
    conn: psycopg.Connection,
    *,
    limit: int,
    offer_case_id: UUID | str | None = None,
) -> list[IntakeJob]:
    """Pasa a ``processing`` hasta ``limit`` trabajos pendientes (o colgados)."""
    rows = conn.execute(
        """
        update public.offer_case_intake as j
        set status = 'processing',
            started_at = now(),
            finished_at = null,
            attempts = j.attempts + 1
        where j.id in (
          select id from public.offer_case_intake
          where (
              status = 'pending'
              or (status = 'processing' and started_at < now() - make_interval(mins => %s))
            )
            and (%s::uuid is null or offer_case_id = %s::uuid)
          order by requested_at
          limit %s
          for update skip locked
        )
        returning j.id, j.offer_case_id, j.attempts
        """,
        (STALE_PROCESSING_MINUTES, offer_case_id, offer_case_id, limit),
    ).fetchall()
    return [IntakeJob(id=r[0], offer_case_id=r[1], attempts=r[2]) for r in rows]


def finish_job(
    conn: psycopg.Connection,
    job_id: UUID,
    *,
    status: str,
    stats: dict[str, Any] | None = None,
    error: str | None = None,
) -> None:
    conn.execute(
        """
        update public.offer_case_intake
        set status = %s, stats = %s, last_error = %s, finished_at = now()
        where id = %s
        """,
        (status, Jsonb(stats or {}), (error or None) and error[:ERROR_MAX], job_id),
    )


def load_case_source(conn: psycopg.Connection, offer_case_id: UUID) -> CaseSource | None:
    """Expediente + RAW PLACSP más reciente de su licitación (si existe)."""
    row = conn.execute(
        """
        select oc.tender_id, oc.target_lots, src.source_code, src.storage_path
        from public.offer_cases oc
        left join lateral (
          select ts.source_code, sa.storage_path
          from public.tender_sources ts
          join public.source_artifacts sa on sa.id = ts.artifact_id
          where ts.tender_id = oc.tender_id
            and ts.source_code = any(%s)
            and sa.storage_path is not null
          order by sa.downloaded_at desc nulls last
          limit 1
        ) src on true
        where oc.id = %s
        """,
        (list(PLACSP_SOURCE_CODES), offer_case_id),
    ).fetchone()
    if row is None:
        return None
    target_lots = row[1]
    if isinstance(target_lots, str):
        target_lots = json.loads(target_lots)
    return CaseSource(
        tender_id=row[0], target_lots=target_lots, source_code=row[2], storage_path=row[3]
    )


def apply_plan(conn: psycopg.Connection, offer_case_id: UUID, plan: IntakePlan) -> ApplyStats:
    """Inserta lo que falta (``on conflict do nothing`` por ``source_key``)."""
    stats = ApplyStats()

    for p in plan.pliegos:
        cur = conn.execute(
            """
            insert into public.offer_case_pliegos
              (offer_case_id, pliego_type, title, url, source_key, source_uri,
               source_hash, fetch_status)
            values (%s, %s, %s, %s, %s, %s, %s, %s)
            on conflict (offer_case_id, source_key) do nothing
            """,
            (
                offer_case_id,
                p.pliego_type,
                p.title,
                p.url,
                p.source_key,
                p.source_uri,
                p.source_hash,
                p.initial_fetch_status,
            ),
        )
        stats.pliegos += cur.rowcount

    pcap_id = _scalar(
        conn,
        """
        select id from public.offer_case_pliegos
        where offer_case_id = %s and pliego_type = 'pcap' and source_key is not null
        order by created_at limit 1
        """,
        (offer_case_id,),
    )
    base_order = _scalar(
        conn,
        "select coalesce(max(sort_order), 0) from public.offer_requirements where offer_case_id = %s",
        (offer_case_id,),
    ) or 0

    for r in plan.requirements:
        cur = conn.execute(
            """
            insert into public.offer_requirements
              (offer_case_id, title, literal_text, category, requirement_type, envelope,
               required_value, source_kind, source_key, pliego_id, sort_order)
            values (%s, %s, %s, %s, %s, %s, %s, 'pliego_xml', %s, %s, %s)
            on conflict (offer_case_id, source_key) do nothing
            """,
            (
                offer_case_id,
                r.title,
                r.literal_text,
                r.category,
                r.requirement_type,
                r.envelope,
                r.required_value,
                r.source_key,
                pcap_id if r.from_pcap else None,
                base_order + r.sort_order,
            ),
        )
        stats.requirements += cur.rowcount

    for d in plan.deliverables:
        cur = conn.execute(
            """
            insert into public.offer_deliverables
              (offer_case_id, parent_id, envelope, title, points_max, sort_order, source_key)
            values (
              %s,
              (select id from public.offer_deliverables
                where offer_case_id = %s and source_key = %s),
              %s, %s, %s, %s, %s
            )
            on conflict (offer_case_id, source_key) do nothing
            """,
            (
                offer_case_id,
                offer_case_id,
                d.parent_key,
                d.envelope,
                d.title,
                d.points_max,
                d.sort_order,
                d.source_key,
            ),
        )
        stats.deliverables += cur.rowcount

    for m in plan.milestones:
        cur = conn.execute(
            """
            insert into public.offer_milestones
              (offer_case_id, kind, code, title, due_at, sort_order, source_key)
            values (%s, 'oficial', %s, %s, %s, %s, %s)
            on conflict (offer_case_id, source_key) do nothing
            """,
            (offer_case_id, m.code, m.title, m.due_at, m.sort_order, m.source_key),
        )
        stats.milestones += cur.rowcount

    return stats


def pending_downloads(conn: psycopg.Connection, offer_case_id: UUID) -> list[PendingDownload]:
    rows = conn.execute(
        """
        select id, source_uri from public.offer_case_pliegos
        where offer_case_id = %s
          and source_uri is not null
          and storage_path is null
          and fetch_status in ('pendiente', 'error')
        order by created_at
        """,
        (offer_case_id,),
    ).fetchall()
    return [PendingDownload(pliego_id=r[0], url=r[1]) for r in rows]


def mark_downloaded(
    conn: psycopg.Connection,
    pliego_id: UUID,
    *,
    storage_path: str,
    checksum: str,
    byte_size: int,
    content_type: str,
) -> None:
    conn.execute(
        """
        update public.offer_case_pliegos
        set storage_path = %s, checksum = %s, byte_size = %s, content_type = %s,
            fetch_status = 'descargado', fetch_error = null, fetched_at = now()
        where id = %s
        """,
        (storage_path, checksum, byte_size, content_type, pliego_id),
    )


def mark_fetch_error(conn: psycopg.Connection, pliego_id: UUID, error: str) -> None:
    conn.execute(
        """
        update public.offer_case_pliegos
        set fetch_status = 'error', fetch_error = %s, fetched_at = now()
        where id = %s
        """,
        (error[:ERROR_MAX], pliego_id),
    )


def log_intake(conn: psycopg.Connection, offer_case_id: UUID, body: str) -> None:
    conn.execute(
        """
        insert into public.offer_case_log (offer_case_id, event_type, body)
        values (%s, 'otro', %s)
        """,
        (offer_case_id, body),
    )


def _scalar(conn: psycopg.Connection, sql: str, params: tuple[Any, ...]) -> Any:
    row = conn.execute(sql, params).fetchone()
    return row[0] if row else None
