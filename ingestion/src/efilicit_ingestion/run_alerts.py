"""Orquestación del job de alertas: match → cola → digest (Semana 5 Paso 9)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from efilicit_ingestion.alerts.batch import run_alert_batch
from efilicit_ingestion.alerts.digest import (
    DigestDrainResult,
    UserEmailDirectory,
    drain_daily_digests,
)
from efilicit_ingestion.alerts.email import FakeEmailSender, ResendEmailSender
from efilicit_ingestion.alerts.models import AlertRule, BatchResult, TenderCandidate
from efilicit_ingestion.alerts.postgres import (
    PostgresNotificationQueue,
    load_active_alerts,
    load_tender_candidates,
    load_user_emails,
)
from efilicit_ingestion.alerts.queue import InMemoryNotificationQueue, digest_day
from efilicit_ingestion.pipeline.postgres import connect


@dataclass(frozen=True, slots=True)
class AlertsRunConfig:
    """dry_run=True (default): fixtures en memoria + FakeEmailSender, sin DB."""

    dry_run: bool = True
    send: bool = False
    digest: date | None = None
    since_days: int = 1
    tender_limit: int = 5000


@dataclass
class AlertsRunResult:
    dry_run: bool
    send: bool
    digest: str
    batch: BatchResult
    drain: DigestDrainResult
    emails_captured: int = 0


def _fixture_alerts() -> list[AlertRule]:
    return [
        AlertRule(
            id="00000000-0000-4000-8000-0000000000a1",
            user_id="00000000-0000-4000-8000-0000000000u1",
            name="Software (dry-run)",
            criteria={"version": 1, "keywords": ["software"]},
        )
    ]


def _fixture_tenders() -> list[TenderCandidate]:
    return [
        TenderCandidate(
            id="00000000-0000-4000-8000-0000000000t1",
            title="Mantenimiento de software",
            description="Servicios de mantenimiento de software",
            status="published",
            contract_type="services",
            estimated_value=Decimal("50000"),
            cpv_code="72000000",
            publication_date=date(2026, 9, 1),
            municipality="Madrid",
            country="ES",
        ),
        TenderCandidate(
            id="00000000-0000-4000-8000-0000000000t2",
            title="Obras de asfaltado",
            description="Obras de carretera",
            status="published",
            contract_type="works",
            estimated_value=Decimal("200000"),
            cpv_code="45233140",
            publication_date=date(2026, 9, 2),
            municipality="Madrid",
            country="ES",
        ),
    ]


def _fixture_directory() -> UserEmailDirectory:
    return UserEmailDirectory(
        emails={"00000000-0000-4000-8000-0000000000u1": "dry-run@example.com"}
    )


def run_alerts(config: AlertsRunConfig | None = None) -> AlertsRunResult:
    cfg = config or AlertsRunConfig()
    digest_key = digest_day(cfg.digest)

    if cfg.dry_run:
        return _run_dry(digest_key=digest_key)

    return _run_write(cfg=cfg, digest_key=digest_key)


def _run_dry(*, digest_key: str) -> AlertsRunResult:
    queue = InMemoryNotificationQueue()
    sender = FakeEmailSender()
    directory = _fixture_directory()
    batch = run_alert_batch(
        alerts=_fixture_alerts(),
        tenders=_fixture_tenders(),
        queue=queue,
        digest=digest_key,
    )
    drain = drain_daily_digests(queue=queue, sender=sender, directory=directory)
    return AlertsRunResult(
        dry_run=True,
        send=False,
        digest=digest_key,
        batch=batch,
        drain=drain,
        emails_captured=len(sender.sent),
    )


def _run_write(*, cfg: AlertsRunConfig, digest_key: str) -> AlertsRunResult:
    since = datetime.now(timezone.utc) - timedelta(days=max(cfg.since_days, 0))
    sender = ResendEmailSender() if cfg.send else FakeEmailSender()

    with connect() as conn:
        alerts = load_active_alerts(conn)
        tenders = load_tender_candidates(
            conn,
            since=since,
            limit=cfg.tender_limit,
        )
        queue = PostgresNotificationQueue(conn)
        batch = run_alert_batch(
            alerts=alerts,
            tenders=tenders,
            queue=queue,
            digest=digest_key,
        )

        user_ids = sorted({item.user_id for item in queue.pending_items()})
        directory = UserEmailDirectory(emails=load_user_emails(conn, user_ids))
        drain = drain_daily_digests(queue=queue, sender=sender, directory=directory)
        conn.commit()

    emails_captured = len(sender.sent) if isinstance(sender, FakeEmailSender) else drain.digests_sent
    return AlertsRunResult(
        dry_run=False,
        send=cfg.send,
        digest=digest_key,
        batch=batch,
        drain=drain,
        emails_captured=emails_captured,
    )


def format_result(result: AlertsRunResult) -> str:
    b = result.batch
    d = result.drain
    mode = "dry-run" if result.dry_run else ("write+resend" if result.send else "write+fake")
    return (
        f"alerts status=success mode={mode} digest={result.digest}\n"
        f"  batch alerts_seen={b.alerts_seen} tenders_seen={b.tenders_seen} "
        f"matches={b.matches} enqueued_new={b.enqueued_new} "
        f"enqueued_existing={b.enqueued_existing} "
        f"skipped_inactive={b.skipped_inactive} "
        f"skipped_empty_criteria={b.skipped_empty_criteria}\n"
        f"  drain attempted={d.digests_attempted} sent={d.digests_sent} "
        f"failed={d.digests_failed} items_sent={d.items_marked_sent} "
        f"items_failed={d.items_marked_failed} emails_captured={result.emails_captured}"
    )
