"""Reintentos de notification_queue: umbrales temporal/gordo → cancelled."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from efilicit_ingestion.alerts.batch import run_alert_batch
from efilicit_ingestion.alerts.digest import UserEmailDirectory, drain_daily_digests
from efilicit_ingestion.alerts.email import FakeEmailSender
from efilicit_ingestion.alerts.models import AlertRule, TenderCandidate
from efilicit_ingestion.alerts.queue import InMemoryNotificationQueue
from efilicit_ingestion.alerts.retry import (
    MAX_ATTEMPTS_HARD,
    MAX_ATTEMPTS_TRANSIENT,
    classify_send_error,
    status_after_failed_attempt,
)


def test_classify_hard_and_transient() -> None:
    assert classify_send_error("no_email_for_user:abc") == "hard"
    assert classify_send_error("RESEND_API_KEY missing") == "hard"
    assert classify_send_error("resend_http_422: invalid") == "hard"
    assert classify_send_error("resend_http_500: boom") == "transient"
    assert classify_send_error("resend_http_429: slow down") == "transient"
    assert classify_send_error("Connection timeout") == "transient"


def test_status_after_failed_attempt_thresholds() -> None:
    assert status_after_failed_attempt(attempts=1, error="resend_http_500: x") == "failed"
    assert status_after_failed_attempt(attempts=2, error="resend_http_500: x") == "failed"
    assert (
        status_after_failed_attempt(attempts=3, error="resend_http_500: x") == "cancelled"
    )
    assert status_after_failed_attempt(attempts=1, error="RESEND_API_KEY missing") == (
        "failed"
    )
    assert status_after_failed_attempt(attempts=2, error="RESEND_API_KEY missing") == (
        "cancelled"
    )
    # Cambio de clase: umbral del error *actual*.
    assert status_after_failed_attempt(attempts=2, error="resend_http_500: x") == "failed"
    assert status_after_failed_attempt(attempts=3, error="RESEND_API_KEY missing") == (
        "cancelled"
    )


def _enqueue_one(queue: InMemoryNotificationQueue) -> None:
    run_alert_batch(
        alerts=[
            AlertRule(
                id="alert-1",
                user_id="user-1",
                name="Software",
                criteria={"version": 1, "keywords": ["software"]},
            )
        ],
        tenders=[
            TenderCandidate(
                id="t-soft",
                title="Mantenimiento de software",
                description="x",
                status="published",
                contract_type="services",
                estimated_value=Decimal("1"),
                cpv_code="72000000",
                publication_date=date(2026, 9, 1),
            )
        ],
        queue=queue,
        digest="2026-09-30",
    )


def test_transient_failures_retry_then_cancel() -> None:
    queue = InMemoryNotificationQueue()
    _enqueue_one(queue)
    sender = FakeEmailSender(
        fail_always=True, fail_error="resend_http_503: unavailable"
    )
    directory = UserEmailDirectory(emails={"user-1": "alice@example.com"})

    for expected_attempts in range(1, MAX_ATTEMPTS_TRANSIENT):
        result = drain_daily_digests(queue=queue, sender=sender, directory=directory)
        assert result.digests_failed == 1
        assert result.items_marked_failed == 1
        assert result.items_marked_cancelled == 0
        item = queue.all_items()[0]
        assert item.status == "failed"
        assert item.attempts == expected_attempts

    last = drain_daily_digests(queue=queue, sender=sender, directory=directory)
    assert last.items_marked_cancelled == 1
    item = queue.all_items()[0]
    assert item.status == "cancelled"
    assert item.attempts == MAX_ATTEMPTS_TRANSIENT

    # cancelled ya no se drena
    noop = drain_daily_digests(queue=queue, sender=sender, directory=directory)
    assert noop.digests_attempted == 0


def test_hard_failures_cancel_sooner() -> None:
    queue = InMemoryNotificationQueue()
    _enqueue_one(queue)
    sender = FakeEmailSender()
    directory = UserEmailDirectory(emails={})  # sin email → gordo

    first = drain_daily_digests(queue=queue, sender=sender, directory=directory)
    assert first.items_marked_failed == 1
    assert queue.all_items()[0].status == "failed"
    assert queue.all_items()[0].attempts == 1

    second = drain_daily_digests(queue=queue, sender=sender, directory=directory)
    assert second.items_marked_cancelled == 1
    assert queue.all_items()[0].status == "cancelled"
    assert queue.all_items()[0].attempts == MAX_ATTEMPTS_HARD


def test_failed_then_success_on_retry() -> None:
    queue = InMemoryNotificationQueue()
    _enqueue_one(queue)
    sender = FakeEmailSender(fail_next=True)
    directory = UserEmailDirectory(emails={"user-1": "alice@example.com"})

    failed = drain_daily_digests(queue=queue, sender=sender, directory=directory)
    assert failed.items_marked_failed == 1
    assert queue.all_items()[0].status == "failed"

    ok = drain_daily_digests(queue=queue, sender=sender, directory=directory)
    assert ok.digests_sent == 1
    assert queue.all_items()[0].status == "sent"
    assert queue.all_items()[0].attempts == 1
