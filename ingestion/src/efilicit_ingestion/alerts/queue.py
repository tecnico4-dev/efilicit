"""Cola de notificaciones e idempotencia (Paso 7.2 / 8).

Contrato compartido por la cola en memoria (tests) y Postgres
(``PostgresNotificationQueue``). La clave evita reenviar el mismo
match alerta×licitación en el mismo periodo de digest.

Frecuencias de cuenta (ADR 013): ``diaria`` | ``semanal``.
``instantanea`` queda fuera del MVP (BACKLOG).
Acepta alias legacy ``daily`` / ``weekly`` al leer.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Protocol

from efilicit_ingestion.alerts.models import AlertMatch, NotificationItem, TenderCandidate
from efilicit_ingestion.alerts.retry import status_after_failed_attempt

DigestFrequency = str  # "diaria" | "semanal"

_DRAINABLE_STATUSES = frozenset({"pending", "failed"})


def normalize_digest_frequency(frequency: str | None) -> DigestFrequency:
    """Normaliza a ``diaria`` | ``semanal`` (acepta daily/weekly legacy)."""
    freq = (frequency or "diaria").strip().lower()
    if freq in {"weekly", "semanal"}:
        return "semanal"
    return "diaria"


def _as_date(value: date | datetime | None = None) -> date:
    if value is None:
        return datetime.now(timezone.utc).date()
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).date() if value.tzinfo else value.date()
    return value


def digest_day(value: date | datetime | None = None) -> str:
    """Periodo diaria: YYYY-MM-DD en UTC."""
    return _as_date(value).isoformat()


def digest_period(
    frequency: DigestFrequency,
    value: date | datetime | None = None,
) -> str:
    """Periodo de idempotencia: día (diaria) o semana ISO (semanal)."""
    d = _as_date(value)
    if normalize_digest_frequency(frequency) == "semanal":
        iso = d.isocalendar()
        return f"{iso.year}-W{iso.week:02d}"
    return d.isoformat()


def should_send_digest(
    frequency: DigestFrequency,
    value: date | datetime | None = None,
) -> bool:
    """¿Toca drenar el digest hoy?

    - diaria: siempre (si hay pending).
    - semanal: solo lunes UTC — el resto de días deja pending en cola.
    """
    d = _as_date(value)
    if normalize_digest_frequency(frequency) == "semanal":
        return d.weekday() == 0
    return True


def make_idempotency_key(
    *,
    alert_id: str,
    tender_id: str,
    digest: str,
) -> str:
    """Clave estable por alerta+licitación+periodo (re-run del job no reenvía)."""
    return f"alert:{alert_id}:tender:{tender_id}:digest:{digest}"


def match_to_notification(
    match: AlertMatch,
    tender: TenderCandidate,
    *,
    digest: str,
    frequency: DigestFrequency = "daily",
) -> NotificationItem:
    """Construye el ítem de cola con payload mínimo para el email de digest."""
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
    """Puerto de cola: insert idempotente + marcar sent/failed/cancelled."""

    def enqueue(self, item: NotificationItem) -> tuple[NotificationItem, bool]:
        """Inserta o reutiliza por idempotency_key.

        Returns:
            (item, created) — created=False si ya existía (no reabre ``sent``).
        """
        ...

    def pending_items(self) -> list[NotificationItem]:
        """Solo ``pending`` (p. ej. tests). El drain usa ``drainable_items``."""
        ...

    def drainable_items(self) -> list[NotificationItem]:
        """Ítems que el job puede intentar enviar: ``pending`` + ``failed``."""
        ...

    def mark_sent(
        self,
        idempotency_key: str,
        *,
        provider_id: str | None = None,
        sent_at: datetime | None = None,
    ) -> None:
        ...

    def mark_failed(self, idempotency_key: str, *, error: str) -> str:
        """Suma ``attempts``; deja ``failed`` o ``cancelled`` según el error actual.

        Returns:
            Nuevo ``status`` (``failed`` | ``cancelled``).
        """
        ...


class InMemoryNotificationQueue:
    """Cola en memoria para tests / dry-run (sin red ni Postgres)."""

    def __init__(self) -> None:
        self._by_key: dict[str, NotificationItem] = {}

    def enqueue(self, item: NotificationItem) -> tuple[NotificationItem, bool]:
        existing = self._by_key.get(item.idempotency_key)
        if existing is not None:
            # No reabrir enviados / cancelled ni duplicar pendientes.
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

    def drainable_items(self) -> list[NotificationItem]:
        return [i for i in self._by_key.values() if i.status in _DRAINABLE_STATUSES]

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

    def mark_failed(self, idempotency_key: str, *, error: str) -> str:
        item = self._by_key[idempotency_key]
        item.attempts += 1
        item.last_error = error
        item.status = status_after_failed_attempt(
            attempts=item.attempts, error=error
        )
        return item.status

    def get(self, idempotency_key: str) -> NotificationItem | None:
        return self._by_key.get(idempotency_key)

    def all_items(self) -> list[NotificationItem]:
        return list(self._by_key.values())
