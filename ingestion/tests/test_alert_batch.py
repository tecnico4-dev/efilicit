"""Semana 5 Paso 7.2: encolado idempotente + batch."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from efilicit_ingestion.alerts.batch import run_alert_batch
from efilicit_ingestion.alerts.models import AlertRule, TenderCandidate
from efilicit_ingestion.alerts.queue import (
    InMemoryNotificationQueue,
    make_idempotency_key,
)


def _tender(tid: str, title: str, cpv: str) -> TenderCandidate:
    return TenderCandidate(
        id=tid,
        title=title,
        description=title,
        status="publicada",
        contract_type="servicios",
        estimated_value=Decimal("50000"),
        cpv_codes=(cpv,),
        publication_date=date(2026, 9, 1),
        municipality="Madrid",
        country="ES",
    )


def test_idempotency_key_stable() -> None:
    assert (
        make_idempotency_key(alert_id="a1", tender_id="t1")
        == "alert:a1:tender:t1"
    )


def test_batch_enqueues_match_and_second_run_is_idempotent() -> None:
    queue = InMemoryNotificationQueue()
    alert = AlertRule(
        id="alert-1",
        user_id="user-1",
        name="Software",
        criteria={"version": 1, "keywords": ["software"]},
    )
    tenders = [
        _tender("t-soft", "Mantenimiento de software", "72000000"),
        _tender("t-road", "Obras de asfaltado", "45233140"),
    ]

    first = run_alert_batch(
        alerts=[alert],
        tenders=tenders,
        queue=queue,
        digest="2026-09-29",
    )
    assert first.matches == 1
    assert first.enqueued_new == 1
    assert first.enqueued_existing == 0
    key = make_idempotency_key(alert_id="alert-1", tender_id="t-soft")
    item = queue.get(key)
    assert item is not None
    assert item.status == "pending"
    assert item.payload["title"] == "Mantenimiento de software"
    assert "digest" not in item.payload

    second = run_alert_batch(
        alerts=[alert],
        tenders=tenders,
        queue=queue,
        digest="2026-09-29",
    )
    assert second.matches == 1
    assert second.enqueued_new == 0
    assert second.enqueued_existing == 1
    assert len(queue.all_items()) == 1


def test_second_run_does_not_reopen_sent() -> None:
    queue = InMemoryNotificationQueue()
    alert = AlertRule(
        id="alert-1",
        user_id="user-1",
        name="Software",
        criteria={"version": 1, "keywords": ["software"]},
    )
    tenders = [_tender("t-soft", "Mantenimiento de software", "72000000")]

    run_alert_batch(alerts=[alert], tenders=tenders, queue=queue, digest="2026-09-29")
    key = make_idempotency_key(alert_id="alert-1", tender_id="t-soft")
    queue.mark_sent(key)
    assert queue.get(key) is not None
    assert queue.get(key).status == "sent"  # type: ignore[union-attr]

    again = run_alert_batch(
        alerts=[alert], tenders=tenders, queue=queue, digest="2026-09-29"
    )
    assert again.enqueued_existing == 1
    assert again.enqueued_new == 0
    assert queue.get(key).status == "sent"  # type: ignore[union-attr]


def test_different_digest_days_do_not_reenqueue() -> None:
    """Misma alerta+licitación en otro día no crea otra fila de cola."""
    queue = InMemoryNotificationQueue()
    alert = AlertRule(
        id="alert-1",
        user_id="user-1",
        name="Software",
        criteria={"version": 1, "keywords": ["software"]},
    )
    tenders = [_tender("t-soft", "Mantenimiento de software", "72000000")]

    first = run_alert_batch(
        alerts=[alert], tenders=tenders, queue=queue, digest=date(2026, 9, 29)
    )
    second = run_alert_batch(
        alerts=[alert], tenders=tenders, queue=queue, digest=date(2026, 9, 30)
    )
    assert first.enqueued_new == 1
    assert second.enqueued_new == 0
    assert second.enqueued_existing == 1
    assert len(queue.all_items()) == 1
    item = queue.all_items()[0]
    assert item.tender_id == "t-soft"


def test_legacy_digest_key_does_not_reenqueue_same_alert_tender() -> None:
    """Fila histórica con :digest: bloquea un enqueue canónico del mismo par."""
    from efilicit_ingestion.alerts.models import AlertMatch, NotificationItem
    from efilicit_ingestion.alerts.queue import match_to_notification

    queue = InMemoryNotificationQueue()
    legacy = NotificationItem(
        user_id="user-1",
        alert_id="alert-1",
        tender_id="t-soft",
        idempotency_key="alert:alert-1:tender:t-soft:digest:2026-11-07",
        payload={"tender_id": "t-soft", "title": "Legacy"},
        status="sent",
    )
    stored, created = queue.enqueue(legacy)
    assert created is True
    assert stored.status == "sent"

    match = AlertMatch(
        alert_id="alert-1",
        user_id="user-1",
        tender_id="t-soft",
        score=1.0,
        priority="high",
        reasons=("keyword",),
    )
    tender = _tender("t-soft", "Mantenimiento de software", "72000000")
    modern = match_to_notification(match, tender, frequency="diaria")
    assert ":digest:" not in modern.idempotency_key
    again, created_again = queue.enqueue(modern)
    assert created_again is False
    assert again.status == "sent"
    assert len(queue.all_items()) == 1


def test_empty_criteria_skipped() -> None:
    queue = InMemoryNotificationQueue()
    alert = AlertRule(
        id="alert-empty",
        user_id="user-1",
        name="Empty",
        criteria={"version": 1},
    )
    result = run_alert_batch(
        alerts=[alert],
        tenders=[_tender("t-soft", "software", "72000000")],
        queue=queue,
        digest="2026-09-29",
    )
    assert result.skipped_empty_criteria == 1
    assert result.matches == 0
    assert queue.all_items() == []
