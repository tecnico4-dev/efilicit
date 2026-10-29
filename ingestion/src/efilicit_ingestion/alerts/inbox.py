"""Buzón in-app al enviar un digest (1 aviso = 1 correo).

Tras Resend OK, el drain registra un ``digest_inbox_notifications`` con los
``tender_ids`` del email. La web lista el aviso y abre el modal con esa lista.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Protocol
from uuid import UUID

from efilicit_ingestion.alerts.models import NotificationItem


@dataclass(frozen=True, slots=True)
class DigestInboxEntry:
    """Aviso in-app materializado (tests / observabilidad)."""

    user_id: str
    frequency: str
    digest_period: str
    sent_at: datetime
    tender_ids: tuple[str, ...]


def tender_ids_from_items(items: list[NotificationItem]) -> list[str]:
    """Extrae tender_id del payload en orden de envío, sin duplicados."""
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        raw = item.payload.get("tender_id")
        if not isinstance(raw, str):
            continue
        tid = raw.strip()
        if not tid or tid in seen:
            continue
        seen.add(tid)
        out.append(tid)
    return out


class DigestInbox(Protocol):
    """Persistencia del aviso in-app tras un digest enviado."""

    def record_sent_digest(
        self,
        *,
        user_id: str,
        frequency: str,
        digest_period: str,
        sent_at: datetime,
        tender_ids: list[str],
    ) -> None: ...


@dataclass
class InMemoryDigestInbox:
    """Cola en memoria para dry-run / tests."""

    entries: list[DigestInboxEntry] = field(default_factory=list)

    def record_sent_digest(
        self,
        *,
        user_id: str,
        frequency: str,
        digest_period: str,
        sent_at: datetime,
        tender_ids: list[str],
    ) -> None:
        key = (user_id, digest_period, frequency)
        if any(
            (e.user_id, e.digest_period, e.frequency) == key for e in self.entries
        ):
            return
        self.entries.append(
            DigestInboxEntry(
                user_id=user_id,
                frequency=frequency,
                digest_period=digest_period,
                sent_at=sent_at,
                tender_ids=tuple(tender_ids),
            )
        )


class PostgresDigestInbox:
    """Inserta en ``public.digest_inbox_notifications`` (idempotente)."""

    def __init__(self, conn) -> None:
        self._conn = conn

    def record_sent_digest(
        self,
        *,
        user_id: str,
        frequency: str,
        digest_period: str,
        sent_at: datetime,
        tender_ids: list[str],
    ) -> None:
        if not tender_ids:
            return
        uuids: list[UUID] = []
        for tid in tender_ids:
            try:
                uuids.append(UUID(tid))
            except ValueError:
                continue
        if not uuids:
            return
        with self._conn.cursor() as cur:
            cur.execute(
                """
                insert into public.digest_inbox_notifications (
                  user_id,
                  frequency,
                  digest_period,
                  sent_at,
                  tender_count,
                  tender_ids
                )
                values (%s, %s, %s, %s, %s, %s::uuid[])
                on conflict (user_id, digest_period, frequency) do nothing
                """,
                (
                    user_id,
                    frequency,
                    digest_period,
                    sent_at,
                    len(uuids),
                    [str(u) for u in uuids],
                ),
            )
