"""Cola de notificaciones e idempotencia (Paso 7.2 / 8)."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Protocol

from efilicit_ingestion.alerts.models import AlertMatch, NotificationItem, TenderCandidate

DigestFrequency = str  # "daily" | "weekly"


def _as_date(value: date | datetime | None = None) -> date:
    if value is None:
        return datetime.now(timezone.utc).date()
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).date() if value.tzinfo else value.date()
    return value


def digest_day(value: date | datetime | None = None) -> str:
    return _as_date(value).isoformat()


def digest_period(
    frequency: DigestFrequency,
    value: date | datetime | None = None,
) -> str:
    """Periodo de idempotencia: día (daily) o semana ISO (weekly)."""
    d = _as_date(value)
    freq = (frequency or "daily").strip().lower()
    if freq == "weekly":
        iso = d.isocalendar()
        return f"{iso.year}-W{iso.week:02d}"
    return d.isoformat()


def should_send_digest(
    frequency: DigestFrequency,
    value: date | datetime | None = None,
) -> bool:
    """daily siempre; weekly solo lunes UTC."""
    d = _as_date(value)
    freq = (frequency or "daily").strip().lower()
    if freq == "weekly":
        return d.weekday() == 0
    return True


def make_idempotency_key(
    *,
    alert_id: str,
    tender_id: str,
    digest: str,
) -> str:
    """Clave estable por alerta+licitación+periodo de digest (no reenvía al reejecutar)."""
    return f"alert:{alert_id}:tender:{tender_id}:digest:{digest}"


def match_to_notification(
    match: AlertMatch,
    tender: TenderCandidate,
    *,
    digest: str,
    frequency: DigestFrequency = "daily",
) -> NotificationItem:
    key = make_idempotency_key(
        alert_id=match.alert_id,
        tender_id=match.tender_id,
        digest=digest,
    )
    return NotificationItem(
        user_id=match.user_id,
        alert_id=match.alert_id,
        idempotency_key=key,
        payload={
            "tender_id": match.tender_id,
            "alert_id": match.alert_id,
            "title": tender.title,
            "score": match.score,
            "priority": match.priority,
            "reasons": list(match.reasons),
            "digest": digest,
            "frequency": (frequency or "daily").strip().lower(),
            "channel": "email",
            "kind": "alert_match",
        },
        status="pending",
        scheduled_at=datetime.now(timezone.utc),
    )


class NotificationQueue(Protocol):
    def enqueue(self, item: NotificationItem) -> tuple[NotificationItem, bool]:
        """Inserta o reutiliza por idempotency_key.

        Returns:
            (item, created) — created=False si ya existía (no reabre ``sent``).
        """
        ...

    def pending_items(self) -> list[NotificationItem]:
        ...

    def mark_sent(
        self,
        idempotency_key: str,
        *,
        provider_id: str | None = None,
        sent_at: datetime | None = None,
    ) -> None:
        ...

    def mark_failed(self, idempotency_key: str, *, error: str) -> None:
        ...


class InMemoryNotificationQueue:
    """Cola en memoria para tests sin red / dry-run."""

    def __init__(self) -> None:
        self._by_key: dict[str, NotificationItem] = {}

    def enqueue(self, item: NotificationItem) -> tuple[NotificationItem, bool]:
        existing = self._by_key.get(item.idempotency_key)
        if existing is not None:
            # No reabrir enviados ni duplicar pendientes.
            return existing, False
        stored = NotificationItem(
            user_id=item.user_id,
            alert_id=item.alert_id,
            idempotency_key=item.idempotency_key,
            payload=dict(item.payload),
            status=item.status,
            attempts=item.attempts,
            last_error=item.last_error,
            scheduled_at=item.scheduled_at,
            sent_at=item.sent_at,
            id=item.id or item.idempotency_key,
        )
        self._by_key[item.idempotency_key] = stored
        return stored, True

    def pending_items(self) -> list[NotificationItem]:
        return [i for i in self._by_key.values() if i.status == "pending"]

    def mark_sent(
        self,
        idempotency_key: str,
        *,
        provider_id: str | None = None,
        sent_at: datetime | None = None,
    ) -> None:
        item = self._by_key[idempotency_key]
        item.status = "sent"
        item.sent_at = sent_at or datetime.now(timezone.utc)
        item.last_error = None
        if provider_id:
            item.payload = {**item.payload, "provider_id": provider_id}

    def mark_failed(self, idempotency_key: str, *, error: str) -> None:
        item = self._by_key[idempotency_key]
        item.status = "failed"
        item.attempts += 1
        item.last_error = error

    def get(self, idempotency_key: str) -> NotificationItem | None:
        return self._by_key.get(idempotency_key)

    def all_items(self) -> list[NotificationItem]:
        return list(self._by_key.values())
