"""Batch de alertas: ventana de tenders → match → notification_queue (Paso 7).

No envía email (eso es Paso 8 / ``drain_daily_digests``). Solo evalúa y encola
con ``idempotency_key`` estable por alerta+licitación.

Un re-run del job (u otro día/semana) no duplica filas ni reabre ítems ya
``sent``: la misma alerta no vuelve a encolar la misma licitación.

La cadencia de envío sigue en ``users.digest_frequency`` (ADR 013) al drenar.
"""

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
    match_to_notification,
)


def run_alert_batch(
    *,
    alerts: list[AlertRule],
    tenders: list[TenderCandidate],
    queue: NotificationQueue,
    digest: date | datetime | str | None = None,
    frequencies: Mapping[str, str] | None = None,
) -> BatchResult:
    """Evalúa alertas activas contra licitaciones de la ventana y encola matches.

    No envía email. Idempotente vía ``idempotency_key`` (alerta+licitación).
    ``digest`` se acepta por compatibilidad con el job runner; no entra en la clave
    ni en el payload.
    """
    from efilicit_ingestion.alerts.queue import normalize_digest_frequency

    _ = digest  # ancla del job runner; la idempotencia ya no depende del periodo
    freqs = {
        k: normalize_digest_frequency(v) for k, v in (frequencies or {}).items()
    }

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

        freq = freqs.get(alert.user_id, "diaria")
        matches = match_alert_to_tenders(alert, tenders)
        for match in matches:
            tender = tenders_by_id.get(match.tender_id)
            if tender is None:
                continue
            result.matches += 1
            item = match_to_notification(
                match,
                tender,
                frequency=freq,
                alert_name=alert.name,
            )
            stored, created = queue.enqueue(item)
            result.items.append(stored)
            if created:
                result.enqueued_new += 1
            else:
                result.enqueued_existing += 1

    return result
