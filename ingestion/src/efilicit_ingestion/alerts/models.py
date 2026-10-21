"""Modelos del motor de alertas batch (Semana 5 Paso 7).

Vistas mínimas en memoria: el batch no arrastra filas canónicas completas.
``AlertMatch`` alimenta la cola; ``NotificationItem`` / ``BatchResult`` son
el estado de encolado e idempotencia (unique en ``idempotency_key``).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID


@dataclass(frozen=True, slots=True)
class TenderCandidate:
    """Proyección mínima de licitación + organismo para matching de alertas.

    Incluye tax_id/nombre del organismo (criteria.authority) y place_* de la
    licitación (criteria.geography.ccaa_codes / municipality_codes). El texto
    ``municipality`` del organismo es solo legacy (ADR 018).
    """

    id: str
    title: str
    description: str | None = None
    status: str | None = None
    procedure_type: str | None = None
    contract_type: str | None = None
    estimated_value: Decimal | float | None = None
    cpv_codes: tuple[str, ...] = ()
    publication_date: date | None = None
    deadline_at: datetime | None = None
    authority_id: str | None = None
    authority_tax_id: str | None = None
    authority_name: str | None = None
    authority_name_normalized: str | None = None
    municipality: str | None = None
    country: str | None = None
    place_ccaa_code: str | None = None
    place_municipality_code: str | None = None
    updated_at: datetime | None = None


@dataclass(frozen=True, slots=True)
class AlertRule:
    """Fila ``alerts`` activa (o candidata) con criteria jsonb ya cargado."""

    id: str
    user_id: str
    name: str
    criteria: dict[str, Any]
    frequency: str = "daily"
    is_active: bool = True


@dataclass(frozen=True, slots=True)
class AlertMatch:
    """Match alert×tender listo para encolar (score/prioridad/razones)."""

    alert_id: str
    user_id: str
    tender_id: str
    score: float
    priority: str  # high | medium | low
    reasons: tuple[str, ...] = ()


@dataclass
class NotificationItem:
    """Fila lógica de ``notification_queue`` (pending → sent / failed)."""

    user_id: str
    alert_id: str | None
    idempotency_key: str
    payload: dict[str, Any]
    status: str = "pending"
    attempts: int = 0
    last_error: str | None = None
    scheduled_at: datetime | None = None
    sent_at: datetime | None = None
    id: str | None = None


@dataclass
class BatchResult:
    """Contadores del pase batch (observabilidad / logs del job)."""

    alerts_seen: int = 0
    tenders_seen: int = 0
    matches: int = 0
    enqueued_new: int = 0
    enqueued_existing: int = 0
    skipped_inactive: int = 0
    skipped_empty_criteria: int = 0
    items: list[NotificationItem] = field(default_factory=list)


def as_uuid_str(value: UUID | str) -> str:
    """Normaliza UUID a str (claves de cola / logs)."""
    return str(value)
