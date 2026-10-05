"""Digest diario/semanal: agrupa pending y envía un email por usuario/periodo (Paso 8).

Batch-first (ADR 011): un correo por (usuario, periodo), no por cada INSERT
de ingesta. El envío lo hace el job Python vía Resend; no hay Edge Function.

Frecuencias (ADR 012):

- daily: drena siempre que haya pending.
- weekly: solo lunes UTC; el resto deja pending.
- instant: fuera del MVP.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Callable

from efilicit_ingestion.alerts.email import EmailMessage, EmailSender
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
    frequency: str = "daily",
) -> EmailMessage:
    """Plantilla mínima texto/HTML del resumen (MVP; sin deep-links aún)."""
    titles = []
    for item in items:
        title = str(item.payload.get("title") or item.payload.get("tender_id") or "licitación")
        titles.append(f"- {title}")

    count = len(items)
    freq = (frequency or "daily").strip().lower()
    label = "semanal" if freq == "weekly" else "diario"
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


def group_pending_by_user_digest(
    items: list[NotificationItem],
) -> dict[tuple[str, str], list[NotificationItem]]:
    """Agrupa pending por (user_id, periodo) para un solo email por grupo."""
    groups: dict[tuple[str, str], list[NotificationItem]] = defaultdict(list)
    for item in items:
        if item.status != "pending":
            continue
        digest = str(item.payload.get("digest") or digest_day())
        groups[(item.user_id, digest)].append(item)
    return dict(groups)


def drain_daily_digests(
    *,
    queue: NotificationQueue,
    sender: EmailSender,
    directory: UserEmailDirectory,
    list_pending: Callable[[], list[NotificationItem]] | None = None,
    frequencies: Mapping[str, str] | None = None,
    job_date: date | datetime | None = None,
) -> DigestDrainResult:
    """Envía un digest por (usuario, periodo) cuando toca según la frecuencia.

    - daily: siempre que haya pending.
    - weekly: solo lunes UTC; el resto de días deja pending.
    Reejecutar tras un envío OK no reenvía: los ítems ya no están ``pending``.
    """
    pending_fn = list_pending or getattr(queue, "pending_items", None)
    if pending_fn is None:
        raise TypeError("queue must expose pending_items() or pass list_pending=")

    freqs = {k: (v or "daily").strip().lower() for k, v in (frequencies or {}).items()}
    pending = list(pending_fn())
    groups = group_pending_by_user_digest(pending)
    result = DigestDrainResult()

    for (user_id, digest), items in sorted(groups.items(), key=lambda x: (x[0][0], x[0][1])):
        freq = freqs.get(user_id) or str(items[0].payload.get("frequency") or "daily")
        freq = freq.strip().lower()
        if not should_send_digest(freq, job_date):
            result.digests_skipped_not_due += 1
            continue

        result.digests_attempted += 1
        to_email = directory.email_for(user_id)
        if not to_email:
            for item in items:
                queue.mark_failed(
                    item.idempotency_key,
                    error=f"no_email_for_user:{user_id}",
                )
                result.items_marked_failed += 1
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
            result.digests_sent += 1
        else:
            for item in items:
                queue.mark_failed(
                    item.idempotency_key,
                    error=send_result.error or "send_failed",
                )
                result.items_marked_failed += 1
            result.digests_failed += 1

    return result
