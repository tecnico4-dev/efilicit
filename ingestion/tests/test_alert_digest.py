"""Semana 5 Paso 8: digest diario + Resend (FakeEmailSender sin red)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from efilicit_ingestion.alerts.batch import run_alert_batch
from efilicit_ingestion.alerts.digest import (
    UserEmailDirectory,
    build_digest_message,
    drain_daily_digests,
)
from efilicit_ingestion.alerts.email import FakeEmailSender
from efilicit_ingestion.alerts.models import AlertRule, TenderCandidate
from efilicit_ingestion.alerts.queue import InMemoryNotificationQueue, make_idempotency_key


def _tender(tid: str, title: str) -> TenderCandidate:
    return TenderCandidate(
        id=tid,
        title=title,
        description=title,
        status="published",
        contract_type="services",
        estimated_value=Decimal("50000"),
        cpv_code="72000000",
        publication_date=date(2026, 9, 1),
        municipality="Madrid",
        country="ES",
    )


def _enqueue_software_match(queue: InMemoryNotificationQueue) -> None:
    alert = AlertRule(
        id="alert-1",
        user_id="user-1",
        name="Software",
        criteria={"version": 1, "keywords": ["software"]},
    )
    run_alert_batch(
        alerts=[alert],
        tenders=[
            _tender("t-soft", "Mantenimiento de software"),
            _tender("t-soft-2", "Software de gestión"),
        ],
        queue=queue,
        digest="2026-09-30",
    )


def test_build_digest_message_groups_titles() -> None:
    queue = InMemoryNotificationQueue()
    _enqueue_software_match(queue)
    pending = queue.pending_items()
    msg = build_digest_message(
        to_email="alice@example.com",
        digest="2026-09-30",
        items=pending,
    )
    assert "alice@example.com" == msg.to
    assert "2 nueva" in msg.subject
    assert "Mantenimiento de software" in msg.text
    assert "Software de gestión" in msg.text


def test_drain_sends_one_digest_and_marks_sent() -> None:
    queue = InMemoryNotificationQueue()
    _enqueue_software_match(queue)
    sender = FakeEmailSender()
    directory = UserEmailDirectory(emails={"user-1": "alice@example.com"})

    result = drain_daily_digests(queue=queue, sender=sender, directory=directory)
    assert result.digests_sent == 1
    assert result.items_marked_sent == 2
    assert len(sender.sent) == 1
    assert sender.sent[0].to == "alice@example.com"
    assert all(i.status == "sent" for i in queue.all_items())


def test_drain_twice_does_not_resend() -> None:
    queue = InMemoryNotificationQueue()
    _enqueue_software_match(queue)
    sender = FakeEmailSender()
    directory = UserEmailDirectory(emails={"user-1": "alice@example.com"})

    first = drain_daily_digests(queue=queue, sender=sender, directory=directory)
    second = drain_daily_digests(queue=queue, sender=sender, directory=directory)

    assert first.digests_sent == 1
    assert second.digests_attempted == 0
    assert second.digests_sent == 0
    assert len(sender.sent) == 1

    # Re-batch same day: enqueue idempotent; still no new pending → no resend
    _enqueue_software_match(queue)
    third = drain_daily_digests(queue=queue, sender=sender, directory=directory)
    assert third.digests_sent == 0
    assert len(sender.sent) == 1
    key = make_idempotency_key(
        alert_id="alert-1", tender_id="t-soft", digest="2026-09-30"
    )
    assert queue.get(key) is not None
    assert queue.get(key).status == "sent"  # type: ignore[union-attr]


def test_drain_marks_failed_without_resend_on_success_path() -> None:
    queue = InMemoryNotificationQueue()
    _enqueue_software_match(queue)
    sender = FakeEmailSender(fail_next=True)
    directory = UserEmailDirectory(emails={"user-1": "alice@example.com"})

    failed = drain_daily_digests(queue=queue, sender=sender, directory=directory)
    assert failed.digests_failed == 1
    assert failed.items_marked_failed == 2
    assert len(sender.sent) == 0
    assert all(i.status == "failed" for i in queue.all_items())
