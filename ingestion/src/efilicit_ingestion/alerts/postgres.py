"""Persistencia Postgres del motor de alertas (cola + lecturas canónicas).

Solo procesos confiables (job con ``EFILICIT_DATABASE_URL`` / service).
La web nunca escribe en ``notification_queue`` ni lee emails de Auth.

Lecturas:

- alertas activas + ventana de tenders (join organismo; paginada, sin techo duro).
- emails y ``digest_frequency`` de cuenta para el drenado.

Escrituras: upsert idempotente en ``notification_queue`` (ON CONFLICT DO NOTHING).
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Json

from efilicit_ingestion.alerts.models import AlertRule, NotificationItem, TenderCandidate
from efilicit_ingestion.alerts.retry import status_after_failed_attempt


def _as_str(value: UUID | str | None) -> str | None:
    if value is None:
        return None
    return str(value)


def load_active_alerts(conn: psycopg.Connection) -> list[AlertRule]:
    """Carga reglas ``is_active`` ordenadas (estable para logs/repro)."""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            select id, user_id, name, criteria, frequency, is_active
            from public.alerts
            where is_active = true
            order by created_at
            """
        )
        rows = cur.fetchall()
    return [
        AlertRule(
            id=str(row["id"]),
            user_id=str(row["user_id"]),
            name=row["name"],
            criteria=dict(row["criteria"] or {}),
            frequency=row["frequency"] or "diaria",
            is_active=bool(row["is_active"]),
        )
        for row in rows
    ]


def _row_to_tender_candidate(row: dict[str, Any]) -> TenderCandidate:
    value = row["estimated_value"]
    return TenderCandidate(
        id=str(row["id"]),
        title=row["title"],
        description=row["description"],
        status=row["status"],
        procedure_type=row["procedure_type"],
        contract_type=row["contract_type"],
        estimated_value=Decimal(str(value)) if value is not None else None,
        cpv_codes=tuple(row["cpv_codes"] or ()),
        publication_date=row["publication_date"],
        deadline_at=row["deadline_at"],
        authority_id=_as_str(row["contracting_authority_id"]),
        authority_tax_id=row["authority_tax_id"],
        authority_name=row["authority_name"],
        authority_name_normalized=row["authority_name_normalized"],
        municipality=row["municipality"],
        country=row["country"],
        place_ccaa_code=row["place_ccaa_code"],
        place_municipality_code=row["place_municipality_code"],
        updated_at=row["updated_at"],
    )


def _normalize_since(since: date | datetime | None) -> datetime:
    if since is None:
        return datetime.now(timezone.utc) - timedelta(days=1)
    if isinstance(since, date) and not isinstance(since, datetime):
        return datetime(since.year, since.month, since.day, tzinfo=timezone.utc)
    return since


def load_tender_candidates_page(
    conn: psycopg.Connection,
    *,
    since: date | datetime | None = None,
    limit: int = 5000,
    before_touch_at: datetime | None = None,
    before_id: str | None = None,
) -> list[tuple[TenderCandidate, datetime]]:
    """Una página de la ventana (más recientes primero).

    ``before_*`` = cursor keyset tras la última fila de la página anterior
    (``touch_at`` DESC, ``id`` DESC). Devuelve (candidato, touch_at) para paginar.
    """
    since_dt = _normalize_since(since)
    page_size = max(1, int(limit))
    use_cursor = before_touch_at is not None and before_id is not None

    sql = """
            select
              t.id,
              t.title,
              t.description,
              t.status,
              t.procedure_type,
              t.contract_type,
              t.estimated_value,
              coalesce(
                (
                  select array_agg(tc.cpv_code order by tc.cpv_code)
                  from public.tender_cpvs tc
                  where tc.tender_id = t.id
                ),
                '{}'::text[]
              ) as cpv_codes,
              t.publication_date,
              t.deadline_at,
              t.updated_at,
              coalesce(t.updated_at, t.created_at) as touch_at,
              t.contracting_authority_id,
              t.place_ccaa_code,
              t.place_municipality_code,
              ca.tax_id as authority_tax_id,
              ca.name as authority_name,
              ca.name_normalized as authority_name_normalized,
              ca.municipality,
              ca.country
            from public.tenders t
            left join public.contracting_authorities ca
              on ca.id = t.contracting_authority_id
            where
              (
                coalesce(t.updated_at, t.created_at) >= %s
                or coalesce(t.publication_date, '-infinity'::date) >= (%s::timestamptz)::date
              )
    """
    params: list[Any] = [since_dt, since_dt]
    if use_cursor:
        sql += """
              and (
                coalesce(t.updated_at, t.created_at) < %s
                or (
                  coalesce(t.updated_at, t.created_at) = %s
                  and t.id < %s::uuid
                )
              )
        """
        params.extend([before_touch_at, before_touch_at, before_id])
    sql += """
            order by coalesce(t.updated_at, t.created_at) desc, t.id desc
            limit %s
    """
    params.append(page_size)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()

    out: list[tuple[TenderCandidate, datetime]] = []
    for row in rows:
        touch = row["touch_at"]
        if touch is not None and touch.tzinfo is None:
            touch = touch.replace(tzinfo=timezone.utc)
        out.append((_row_to_tender_candidate(row), touch))
    return out


def collect_paginated_candidates(
    fetch_page: Callable[
        [datetime | None, str | None],
        list[tuple[TenderCandidate, datetime]],
    ],
    *,
    page_size: int = 5000,
) -> list[TenderCandidate]:
    """Acumula páginas hasta agotar la ventana (helper testeable sin Postgres).

    ``fetch_page(before_touch_at, before_id)`` → lista ``(TenderCandidate, touch_at)``.
    """
    page_size = max(1, int(page_size))
    out: list[TenderCandidate] = []
    seen: set[str] = set()
    before_touch_at: datetime | None = None
    before_id: str | None = None

    while True:
        page = fetch_page(before_touch_at, before_id)
        if not page:
            break
        for candidate, touch_at in page:
            if candidate.id in seen:
                continue
            seen.add(candidate.id)
            out.append(candidate)
        if len(page) < page_size:
            break
        last_candidate, last_touch = page[-1]
        before_touch_at = last_touch
        before_id = last_candidate.id
    return out


def load_tender_candidates(
    conn: psycopg.Connection,
    *,
    since: date | datetime | None = None,
    limit: int = 5000,
) -> list[TenderCandidate]:
    """Toda la ventana de matching; ``limit`` = tamaño de página (no techo).

    Incluye organismo (authority) y place_* de la licitación (geography).
    Pagina por keyset hasta agotar filas del «since».
    """
    page_size = max(1, int(limit))

    def fetch_page(
        before_touch_at: datetime | None,
        before_id: str | None,
    ) -> list[tuple[TenderCandidate, datetime]]:
        return load_tender_candidates_page(
            conn,
            since=since,
            limit=page_size,
            before_touch_at=before_touch_at,
            before_id=before_id,
        )

    return collect_paginated_candidates(fetch_page, page_size=page_size)


def load_user_emails(
    conn: psycopg.Connection,
    user_ids: list[str],
) -> dict[str, str]:
    """``public.users.id`` → ``auth.users.email`` (conexión trusted / service)."""
    if not user_ids:
        return {}
    ids = [UUID(u) for u in user_ids]
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            select u.id::text as user_id, au.email
            from public.users u
            join auth.users au on au.id = u.auth_user_id
            where u.id = any(%s)
              and au.email is not null
              and au.email <> ''
            """,
            (ids,),
        )
        rows = cur.fetchall()
    return {row["user_id"]: row["email"] for row in rows}


def load_user_digest_frequencies(
    conn: psycopg.Connection,
    user_ids: list[str] | None = None,
) -> dict[str, str]:
    """``public.users.id`` → ``digest_frequency`` (diaria|semanal; ADR 013)."""
    from efilicit_ingestion.alerts.queue import normalize_digest_frequency

    with conn.cursor(row_factory=dict_row) as cur:
        if user_ids:
            ids = [UUID(u) for u in user_ids]
            cur.execute(
                """
                select id::text as user_id, digest_frequency
                from public.users
                where id = any(%s)
                """,
                (ids,),
            )
        else:
            cur.execute(
                """
                select id::text as user_id, digest_frequency
                from public.users
                """
            )
        rows = cur.fetchall()
    return {
        row["user_id"]: normalize_digest_frequency(row["digest_frequency"])
        for row in rows
    }


def _row_to_item(row: dict[str, Any]) -> NotificationItem:
    return NotificationItem(
        id=str(row["id"]),
        user_id=str(row["user_id"]),
        alert_id=_as_str(row["alert_id"]),
        idempotency_key=row["idempotency_key"],
        payload=dict(row["payload"] or {}),
        status=row["status"],
        attempts=int(row["attempts"] or 0),
        last_error=row["last_error"],
        scheduled_at=row["scheduled_at"],
        sent_at=row["sent_at"],
    )


class PostgresNotificationQueue:
    """Cola ``notification_queue`` con upsert por ``idempotency_key``.

    ON CONFLICT DO NOTHING: si la clave ya existe (pending o sent), se reutiliza
    la fila y no se reabre un envío previo.
    """

    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn

    def enqueue(self, item: NotificationItem) -> tuple[NotificationItem, bool]:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                insert into public.notification_queue (
                  user_id, alert_id, status, idempotency_key,
                  attempts, last_error, payload, scheduled_at, sent_at
                )
                values (
                  %s::uuid, %s::uuid, %s, %s,
                  %s, %s, %s, coalesce(%s, now()), %s
                )
                on conflict (idempotency_key) do nothing
                returning *
                """,
                (
                    item.user_id,
                    item.alert_id,
                    item.status,
                    item.idempotency_key,
                    item.attempts,
                    item.last_error,
                    Json(item.payload),
                    item.scheduled_at,
                    item.sent_at,
                ),
            )
            inserted = cur.fetchone()
            if inserted is not None:
                return _row_to_item(inserted), True

            cur.execute(
                """
                select *
                from public.notification_queue
                where idempotency_key = %s
                """,
                (item.idempotency_key,),
            )
            existing = cur.fetchone()
            if existing is None:
                raise RuntimeError(
                    f"notification_queue missing after conflict: {item.idempotency_key}"
                )
            return _row_to_item(existing), False

    def pending_items(self) -> list[NotificationItem]:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                select *
                from public.notification_queue
                where status = 'pending'
                order by scheduled_at, created_at
                """
            )
            return [_row_to_item(row) for row in cur.fetchall()]

    def drainable_items(self) -> list[NotificationItem]:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                select *
                from public.notification_queue
                where status in ('pending', 'failed')
                order by scheduled_at, created_at
                """
            )
            return [_row_to_item(row) for row in cur.fetchall()]

    def mark_sent(
        self,
        idempotency_key: str,
        *,
        provider_id: str | None = None,
        sent_at: datetime | None = None,
    ) -> None:
        when = sent_at or datetime.now(timezone.utc)
        with self._conn.cursor() as cur:
            if provider_id:
                cur.execute(
                    """
                    update public.notification_queue
                    set status = 'sent',
                        sent_at = %s,
                        last_error = null,
                        payload = payload || %s::jsonb
                    where idempotency_key = %s
                    """,
                    (when, Json({"provider_id": provider_id}), idempotency_key),
                )
            else:
                cur.execute(
                    """
                    update public.notification_queue
                    set status = 'sent',
                        sent_at = %s,
                        last_error = null
                    where idempotency_key = %s
                    """,
                    (when, idempotency_key),
                )

    def mark_failed(self, idempotency_key: str, *, error: str) -> str:
        err = error[:2000]
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                select attempts
                from public.notification_queue
                where idempotency_key = %s
                for update
                """,
                (idempotency_key,),
            )
            row = cur.fetchone()
            if row is None:
                raise RuntimeError(
                    f"notification_queue missing for mark_failed: {idempotency_key}"
                )
            attempts = int(row["attempts"] or 0) + 1
            status = status_after_failed_attempt(attempts=attempts, error=err)
            cur.execute(
                """
                update public.notification_queue
                set status = %s,
                    attempts = %s,
                    last_error = %s
                where idempotency_key = %s
                """,
                (status, attempts, err, idempotency_key),
            )
            return status
