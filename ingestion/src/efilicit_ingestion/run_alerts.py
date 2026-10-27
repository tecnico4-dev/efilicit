"""Orquestación del job de alertas: match → cola → digest (Semana 5+ / ADR 020).

Entrada CLI / GitHub Actions. Modos:

- dry-run (default): fixtures en memoria + FakeEmailSender — sin DB ni Resend.
- write: Postgres real; fase ``match`` / ``send`` / ``all``.
- send=True: Resend real (solo con fase ``send`` o ``all``).

Cadencias de producción (ADR 020):

- match post-ingesta (lunes): ventana = sync success del día + ``updated_at``.
- digest diario: solo drenado de ``notification_queue`` (sin match / sin since_days).

Envío desde Python, no Edge Function (ADR 012).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Literal

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
    list_success_sync_windows,
    load_active_alerts,
    load_tender_candidates_for_sync_day,
    load_user_digest_frequencies,
    load_user_emails,
)
from efilicit_ingestion.alerts.queue import InMemoryNotificationQueue, digest_day
from efilicit_ingestion.pipeline.postgres import connect

AlertsPhase = Literal["all", "match", "send"]


@dataclass(frozen=True, slots=True)
class AlertsRunConfig:
    """dry_run=True (default): fixtures en memoria + FakeEmailSender, sin DB."""

    dry_run: bool = True
    send: bool = False
    digest: date | None = None
    # Día UTC cuyas syncs success definen la ventana de match (default = digest/hoy).
    sync_date: date | None = None
    phase: AlertsPhase = "all"
    # Tamaño de página al leer la ventana; se pagina hasta agotar (no es techo).
    tender_limit: int = 5000


@dataclass
class AlertsRunResult:
    dry_run: bool
    send: bool
    phase: AlertsPhase
    digest: str
    sync_date: str | None
    batch: BatchResult
    drain: DigestDrainResult
    emails_captured: int = 0
    sync_windows: int = 0


def _fixture_alerts() -> list[AlertRule]:
    """Alerta mínima con keyword para el dry-run de CI."""
    return [
        AlertRule(
            id="00000000-0000-4000-8000-0000000000a1",
            user_id="00000000-0000-4000-8000-0000000000u1",
            name="Software (dry-run)",
            criteria={"version": 1, "keywords": ["software"]},
        )
    ]


def _fixture_tenders() -> list[TenderCandidate]:
    """Una licitación que hace match y otra que no (smoke del matcher)."""
    return [
        TenderCandidate(
            id="00000000-0000-4000-8000-0000000000t1",
            title="Mantenimiento de software",
            description="Servicios de mantenimiento de software",
            status="publicada",
            contract_type="servicios",
            estimated_value=Decimal("50000"),
            cpv_codes=("72000000",),
            publication_date=date(2026, 9, 1),
            municipality="Madrid",
            country="ES",
        ),
        TenderCandidate(
            id="00000000-0000-4000-8000-0000000000t2",
            title="Obras de asfaltado",
            description="Obras de carretera",
            status="publicada",
            contract_type="obras",
            estimated_value=Decimal("200000"),
            cpv_codes=("45233140",),
            publication_date=date(2026, 9, 2),
            municipality="Madrid",
            country="ES",
        ),
    ]


def _fixture_directory() -> UserEmailDirectory:
    return UserEmailDirectory(
        emails={"00000000-0000-4000-8000-0000000000u1": "dry-run@example.com"}
    )


def _job_date(cfg: AlertsRunConfig) -> date:
    return cfg.digest or datetime.now(timezone.utc).date()


def _sync_date(cfg: AlertsRunConfig, job_date: date) -> date:
    return cfg.sync_date or job_date


def run_alerts(config: AlertsRunConfig | None = None) -> AlertsRunResult:
    """Ejecuta match y/o drain según ``phase`` y el modo configurado."""
    cfg = config or AlertsRunConfig()
    job_date = _job_date(cfg)
    digest_key = digest_day(job_date)
    sync_day = _sync_date(cfg, job_date)

    if cfg.dry_run:
        return _run_dry(
            job_date=job_date,
            digest_key=digest_key,
            sync_day=sync_day,
            phase=cfg.phase,
        )

    return _run_write(
        cfg=cfg,
        job_date=job_date,
        digest_key=digest_key,
        sync_day=sync_day,
    )


def _run_dry(
    *,
    job_date: date,
    digest_key: str,
    sync_day: date,
    phase: AlertsPhase,
) -> AlertsRunResult:
    """Camino seguro por defecto: sin secretos, sin writes."""
    queue = InMemoryNotificationQueue()
    sender = FakeEmailSender()
    directory = _fixture_directory()
    frequencies = {"00000000-0000-4000-8000-0000000000u1": "diaria"}

    batch = BatchResult()
    if phase in ("all", "match"):
        batch = run_alert_batch(
            alerts=_fixture_alerts(),
            tenders=_fixture_tenders(),
            queue=queue,
            digest=job_date,
            frequencies=frequencies,
        )

    drain = DigestDrainResult()
    if phase in ("all", "send"):
        drain = drain_daily_digests(
            queue=queue,
            sender=sender,
            directory=directory,
            frequencies=frequencies,
            job_date=job_date,
        )

    return AlertsRunResult(
        dry_run=True,
        send=False,
        phase=phase,
        digest=digest_key,
        sync_date=sync_day.isoformat(),
        batch=batch,
        drain=drain,
        emails_captured=len(sender.sent),
        sync_windows=1 if phase in ("all", "match") else 0,
    )


def _run_write(
    *,
    cfg: AlertsRunConfig,
    job_date: date,
    digest_key: str,
    sync_day: date,
) -> AlertsRunResult:
    """Camino real: Postgres; Resend solo si ``send`` y fase con drain."""
    do_match = cfg.phase in ("all", "match")
    do_send = cfg.phase in ("all", "send")
    sender = (
        ResendEmailSender()
        if (cfg.send and do_send)
        else FakeEmailSender()
    )

    sync_windows = 0
    batch = BatchResult()
    drain = DigestDrainResult()

    with connect() as conn:
        frequencies: dict[str, str] = {}
        queue = PostgresNotificationQueue(conn)

        if do_match:
            windows = list_success_sync_windows(conn, on_date=sync_day)
            sync_windows = len(windows)
            alerts = load_active_alerts(conn)
            alert_user_ids = sorted({a.user_id for a in alerts})
            frequencies = load_user_digest_frequencies(conn, alert_user_ids)
            tenders = load_tender_candidates_for_sync_day(
                conn,
                on_date=sync_day,
                limit=cfg.tender_limit,
            )
            batch = run_alert_batch(
                alerts=alerts,
                tenders=tenders,
                queue=queue,
                digest=job_date,
                frequencies=frequencies,
            )

        if do_send:
            user_ids = sorted({item.user_id for item in queue.drainable_items()})
            if user_ids:
                frequencies = {
                    **frequencies,
                    **load_user_digest_frequencies(conn, user_ids),
                }
            directory = UserEmailDirectory(emails=load_user_emails(conn, user_ids))
            drain = drain_daily_digests(
                queue=queue,
                sender=sender,
                directory=directory,
                frequencies=frequencies,
                job_date=job_date,
            )

        conn.commit()

    emails_captured = (
        len(sender.sent) if isinstance(sender, FakeEmailSender) else drain.digests_sent
    )
    return AlertsRunResult(
        dry_run=False,
        send=bool(cfg.send and do_send),
        phase=cfg.phase,
        digest=digest_key,
        sync_date=sync_day.isoformat() if do_match else None,
        batch=batch,
        drain=drain,
        emails_captured=emails_captured,
        sync_windows=sync_windows,
    )


def format_result(result: AlertsRunResult) -> str:
    """Línea de resumen estable para logs de CI (parseable a ojo)."""
    b = result.batch
    d = result.drain
    if result.dry_run:
        mode = "dry-run"
    elif result.send:
        mode = "write+resend"
    else:
        mode = "write+fake"
    sync_bit = (
        f" sync_date={result.sync_date} sync_windows={result.sync_windows}"
        if result.sync_date is not None
        else ""
    )
    return (
        f"alerts status=success mode={mode} phase={result.phase} "
        f"digest={result.digest}{sync_bit}\n"
        f"  batch alerts_seen={b.alerts_seen} tenders_seen={b.tenders_seen} "
        f"matches={b.matches} enqueued_new={b.enqueued_new} "
        f"enqueued_existing={b.enqueued_existing} "
        f"skipped_inactive={b.skipped_inactive} "
        f"skipped_empty_criteria={b.skipped_empty_criteria}\n"
        f"  drain attempted={d.digests_attempted} sent={d.digests_sent} "
        f"failed={d.digests_failed} skipped_not_due={d.digests_skipped_not_due} "
        f"items_sent={d.items_marked_sent} "
        f"items_failed={d.items_marked_failed} "
        f"items_cancelled={d.items_marked_cancelled} "
        f"emails_captured={result.emails_captured}"
    )
