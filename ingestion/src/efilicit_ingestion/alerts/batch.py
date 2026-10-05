"""Batch de alertas: ventana de tenders → match → notification_queue (Paso 7)."""

from __future__ import annotations

from collections.abc import Mapping
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
    digest_period,
    match_to_notification,
)


def _job_date(digest: date | datetime | str | None) -> date | None:
    if digest is None:
        return None
    if isinstance(digest, datetime):
        return digest.date()
    if isinstance(digest, date):
        return digest
    # Explicit period string for tests (YYYY-MM-DD); weekly ISO keys are not dates.
    if len(digest) == 10 and digest[4] == "-" and digest[7] == "-":
        return date.fromisoformat(digest)
    return None


def run_alert_batch(
    *,
    alerts: list[AlertRule],
    tenders: list[TenderCandidate],
    queue: NotificationQueue,
    digest: date | datetime | str | None = None,
    frequencies: Mapping[str, str] | None = None,
) -> BatchResult:
    """Evalúa alertas activas contra licitaciones de la ventana y encola matches.

    No envía email (Paso 8). Idempotente vía ``idempotency_key``.
    El periodo de digest es por cuenta: daily → día; weekly → semana ISO.
    """
    freqs = {k: (v or "daily").strip().lower() for k, v in (frequencies or {}).items()}
    job_date = _job_date(digest)
    if isinstance(digest, str) and job_date is None and not freqs:
        default_period = digest
    elif job_date is not None:
        default_period = digest_day(job_date)
    else:
        default_period = digest_day(None)
        job_date = date.fromisoformat(default_period)

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

        freq = freqs.get(alert.user_id, "daily")
        if freqs and job_date is not None:
            period = digest_period(freq, job_date)
        else:
            period = default_period

        matches = match_alert_to_tenders(alert, tenders)
        for match in matches:
            tender = tenders_by_id.get(match.tender_id)
            if tender is None:
                continue
            result.matches += 1
            item = match_to_notification(
                match, tender, digest=period, frequency=freq
            )
            stored, created = queue.enqueue(item)
            result.items.append(stored)
            if created:
                result.enqueued_new += 1
            else:
                result.enqueued_existing += 1

    return result
