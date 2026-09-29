"""Modelos del motor de alertas batch (Semana 5 Paso 7)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID


@dataclass(frozen=True, slots=True)
class TenderCandidate:
    """Vista mínima de una licitación canónica para matching de alertas."""

    id: str
    title: str
    description: str | None = None
    status: str | None = None
    procedure_type: str | None = None
    contract_type: str | None = None
    estimated_value: Decimal | float | None = None
    cpv_code: str | None = None
    publication_date: date | None = None
    deadline_at: datetime | None = None
    authority_id: str | None = None
    authority_tax_id: str | None = None
    authority_name: str | None = None
    authority_name_normalized: str | None = None
    municipality: str | None = None
    country: str | None = None
    updated_at: datetime | None = None


@dataclass(frozen=True, slots=True)
class AlertRule:
    id: str
    user_id: str
    name: str
    criteria: dict[str, Any]
    frequency: str = "daily"
    is_active: bool = True


@dataclass(frozen=True, slots=True)
class AlertMatch:
    alert_id: str
    user_id: str
    tender_id: str
    score: float
    priority: str  # high | medium | low
    reasons: tuple[str, ...] = ()


@dataclass
class NotificationItem:
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
    alerts_seen: int = 0
    tenders_seen: int = 0
    matches: int = 0
    enqueued_new: int = 0
    enqueued_existing: int = 0
    skipped_inactive: int = 0
    skipped_empty_criteria: int = 0
    items: list[NotificationItem] = field(default_factory=list)


def as_uuid_str(value: UUID | str) -> str:
    return str(value)
