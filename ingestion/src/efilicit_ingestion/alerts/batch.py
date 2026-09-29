"""Batch de alertas: ventana de tenders → match → notification_queue (Paso 7)."""

from __future__ import annotations

from datetime import date, datetime

from efilicit_ingestion.alerts.criteria import parse_criteria
from efilicit_ingestion.alerts.match import match_alert_to_tenders
from efilicit_ingestion.alerts.models import (
    AlertRule,
    BatchResult,
    TenderCandidate,
)
from efilicit_ingestion.alerts.queue import (
    NotificationQueue,
    digest_day,
    match_to_notification,
)


def run_alert_batch(
    *,
    alerts: list[AlertRule],
    tenders: list[TenderCandidate],
    queue: NotificationQueue,
    digest: date | datetime | str | None = None,
) -> BatchResult:
    """Evalúa alertas activas contra licitaciones de la ventana y encola matches.

    No envía email (Paso 8). Idempotente vía ``idempotency_key``.
    """
    if isinstance(digest, str):
        digest_key = digest
    else:
        digest_key = digest_day(digest)

    tenders_by_id = {t.id: t for t in tenders}
    result = BatchResult(alerts_seen=len(alerts), tenders_seen=len(tenders))

    for alert in alerts:
        if not alert.is_active:
            result.skipped_inactive += 1
            continue

        criteria = parse_criteria(alert.criteria)
        if not criteria.has_filters():
            result.skipped_empty_criteria += 1
            continue

        matches = match_alert_to_tenders(alert, tenders)
        for match in matches:
            tender = tenders_by_id.get(match.tender_id)
            if tender is None:
                continue
            result.matches += 1
            item = match_to_notification(match, tender, digest=digest_key)
            stored, created = queue.enqueue(item)
            result.items.append(stored)
            if created:
                result.enqueued_new += 1
            else:
                result.enqueued_existing += 1

    return result
