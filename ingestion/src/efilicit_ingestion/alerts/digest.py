"""Digest diario/semanal: agrupa drainable y envía un email por usuario/periodo (Paso 8).

Batch-first (ADR 012): un correo por (usuario, periodo), no por cada INSERT
de ingesta. El envío lo hace el job Python vía Resend; no hay Edge Function.

Frecuencias (ADR 013):

- daily: drena siempre que haya ítems drainable.
- weekly: solo lunes UTC; el resto deja pending/failed.
- instant: fuera del MVP.

Reintentos de cola (sin ADR): tras un fallo, ``failed`` sigue siendo drainable
hasta agotar el umbral del error actual; luego ``cancelled``.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Callable

from efilicit_ingestion.alerts.email import EmailMessage, EmailSender
from efilicit_ingestion.alerts.inbox import DigestInbox, tender_ids_from_items
from efilicit_ingestion.alerts.models import NotificationItem
from efilicit_ingestion.alerts.queue import (
    NotificationQueue,
    digest_day,
    should_send_digest,
)


@dataclass
class DigestDrainResult:
    """Contadores del drenado (logs del job / CI)."""

    digests_attempted: int = 0
    digests_sent: int = 0
    digests_failed: int = 0
    digests_skipped_not_due: int = 0
    items_marked_sent: int = 0
    items_marked_failed: int = 0
    items_marked_cancelled: int = 0
    skipped_already_sent: int = 0


@dataclass
class UserEmailDirectory:
    """Resuelve ``public.users.id`` → email de Auth (solo procesos trusted)."""

    emails: dict[str, str] = field(default_factory=dict)

    def email_for(self, user_id: str) -> str | None:
        return self.emails.get(user_id)


def build_digest_message(
    *,
    to_email: str,
    digest: str,
    items: list[NotificationItem],
    frequency: str = "diaria",
) -> EmailMessage:
    """Plantilla mínima texto/HTML del resumen (MVP; sin deep-links aún)."""
    from efilicit_ingestion.alerts.queue import normalize_digest_frequency

    titles = []
    for item in items:
        title = str(item.payload.get("title") or item.payload.get("tender_id") or "licitación")
        titles.append(f"- {title}")

    count = len(items)
    freq = normalize_digest_frequency(frequency)
    label = "semanal" if freq == "semanal" else "diario"
    subject = (
        f"Resumen {label} EfiLicit — {count} nueva{'s' if count != 1 else ''} "
        f"oportunidad{'es' if count != 1 else ''}"
    )
    text = (
        f"EfiLicit — digest {label} {digest}\n\n"
        f"Tienes {count} coincidencia(s) con tus alertas:\n\n"
        + "\n".join(titles)
        + "\n\n(Semana 5 — digest batch; no es un email por cada INSERT.)\n"
    )
    html_items = "".join(f"<li>{_escape(t[2:])}</li>" for t in titles)
    html = (
        f"<p><strong>EfiLicit</strong> — digest {label} {digest}</p>"
        f"<p>Tienes {count} coincidencia(s) con tus alertas:</p>"
        f"<ul>{html_items}</ul>"
    )
    return EmailMessage(
        to=to_email,
        subject=subject,
        text=text,
        html=html,
        tags=("digest", freq, digest),
    )


def _escape(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def group_drainable_by_user_digest(
    items: list[NotificationItem],
) -> dict[tuple[str, str], list[NotificationItem]]:
    """Agrupa ``pending``/``failed`` por (user_id, periodo) para un solo email."""
    groups: dict[tuple[str, str], list[NotificationItem]] = defaultdict(list)
    for item in items:
        if item.status not in {"pending", "failed"}:
            continue
        digest = str(item.payload.get("digest") or digest_day())
        groups[(item.user_id, digest)].append(item)
    return dict(groups)


# Compat tests / callers antiguos
group_pending_by_user_digest = group_drainable_by_user_digest


def _record_failure_counts(
    result: DigestDrainResult,
    statuses: list[str],
) -> None:
    for status in statuses:
        if status == "cancelled":
            result.items_marked_cancelled += 1
        else:
            result.items_marked_failed += 1


def drain_daily_digests(
    *,
    queue: NotificationQueue,
    sender: EmailSender,
    directory: UserEmailDirectory,
    list_pending: Callable[[], list[NotificationItem]] | None = None,
    frequencies: Mapping[str, str] | None = None,
    job_date: date | datetime | None = None,
    inbox: DigestInbox | None = None,
) -> DigestDrainResult:
    """Envía un digest por (usuario, periodo) cuando toca según la frecuencia.

    - daily: siempre que haya ítems drainable.
    - weekly: solo lunes UTC; el resto de días no envía.
    Reejecutar tras un envío OK no reenvía: los ítems ya no están drainable.
    Tras fallo: ``failed`` reintentable o ``cancelled`` si agota el umbral.
    Si ``inbox`` está definido, materializa un aviso in-app (1 = 1 correo).
    """
    if list_pending is not None:
        pending_fn = list_pending
    else:
        pending_fn = getattr(queue, "drainable_items", None) or getattr(
            queue, "pending_items", None
        )
    if pending_fn is None:
        raise TypeError(
            "queue must expose drainable_items()/pending_items() or pass list_pending="
        )

    from efilicit_ingestion.alerts.queue import normalize_digest_frequency

    freqs = {
        k: normalize_digest_frequency(v) for k, v in (frequencies or {}).items()
    }
    drainable = list(pending_fn())
    groups = group_drainable_by_user_digest(drainable)
    result = DigestDrainResult()

    for (user_id, digest), items in sorted(groups.items(), key=lambda x: (x[0][0], x[0][1])):
        freq = normalize_digest_frequency(
            freqs.get(user_id)
            or str(items[0].payload.get("frequency") or "diaria")
        )
        if not should_send_digest(freq, job_date):
            result.digests_skipped_not_due += 1
            continue

        result.digests_attempted += 1
        to_email = directory.email_for(user_id)
        if not to_email:
            statuses = [
                queue.mark_failed(
                    item.idempotency_key,
                    error=f"no_email_for_user:{user_id}",
                )
                for item in items
            ]
            _record_failure_counts(result, statuses)
            result.digests_failed += 1
            continue

        message = build_digest_message(
            to_email=to_email,
            digest=digest,
            items=items,
            frequency=freq,
        )
        send_result = sender.send(message)
        now = datetime.now(timezone.utc)

        if send_result.ok:
            for item in items:
                queue.mark_sent(
                    item.idempotency_key,
                    provider_id=send_result.provider_id,
                    sent_at=now,
                )
                result.items_marked_sent += 1
            if inbox is not None:
                tids = tender_ids_from_items(items)
                if tids:
                    inbox.record_sent_digest(
                        user_id=user_id,
                        frequency=freq,
                        digest_period=digest,
                        sent_at=now,
                        tender_ids=tids,
                    )
            result.digests_sent += 1
        else:
            err = send_result.error or "send_failed"
            statuses = [
                queue.mark_failed(item.idempotency_key, error=err) for item in items
            ]
            _record_failure_counts(result, statuses)
            result.digests_failed += 1

    return result
