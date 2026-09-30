"""Digest diario: agrupa pending de la cola y envía un email por usuario (Paso 8)."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable

from efilicit_ingestion.alerts.email import EmailMessage, EmailSender
from efilicit_ingestion.alerts.models import NotificationItem
from efilicit_ingestion.alerts.queue import NotificationQueue, digest_day


@dataclass
class DigestDrainResult:
    digests_attempted: int = 0
    digests_sent: int = 0
    digests_failed: int = 0
    items_marked_sent: int = 0
    items_marked_failed: int = 0
    skipped_already_sent: int = 0


@dataclass
class UserEmailDirectory:
    """Resuelve user_id (public.users.id) → email de notificación."""

    emails: dict[str, str] = field(default_factory=dict)

    def email_for(self, user_id: str) -> str | None:
        return self.emails.get(user_id)


def build_digest_message(
    *,
    to_email: str,
    digest: str,
    items: list[NotificationItem],
) -> EmailMessage:
    titles = []
    for item in items:
        title = str(item.payload.get("title") or item.payload.get("tender_id") or "licitación")
        titles.append(f"- {title}")

    count = len(items)
    subject = f"Resumen diario EfiLicit — {count} nueva{'s' if count != 1 else ''} oportunidad{'es' if count != 1 else ''}"
    text = (
        f"EfiLicit — digest {digest}\n\n"
        f"Tienes {count} coincidencia(s) con tus alertas:\n\n"
        + "\n".join(titles)
        + "\n\n(Semana 5 — digest batch; no es un email por cada INSERT.)\n"
    )
    html_items = "".join(f"<li>{_escape(t[2:])}</li>" for t in titles)
    html = (
        f"<p><strong>EfiLicit</strong> — digest {digest}</p>"
        f"<p>Tienes {count} coincidencia(s) con tus alertas:</p>"
        f"<ul>{html_items}</ul>"
    )
    return EmailMessage(
        to=to_email,
        subject=subject,
        text=text,
        html=html,
        tags=("digest", digest),
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
) -> DigestDrainResult:
    """Envía un digest por (usuario, día) y marca ítems sent/failed.

    Reejecutar tras un envío OK no reenvía: los ítems ya no están ``pending``.
    """
    pending_fn = list_pending or getattr(queue, "pending_items", None)
    if pending_fn is None:
        raise TypeError("queue must expose pending_items() or pass list_pending=")

    pending = list(pending_fn())
    groups = group_pending_by_user_digest(pending)
    result = DigestDrainResult()

    for (user_id, digest), items in sorted(groups.items(), key=lambda x: (x[0][0], x[0][1])):
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

        message = build_digest_message(to_email=to_email, digest=digest, items=items)
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
