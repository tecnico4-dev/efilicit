"""Digest diario/semanal: agrupa drainable y envía un email por usuario/periodo (Paso 8).

Batch-first (ADR 012): un correo por (usuario, periodo), no por cada INSERT
de ingesta. El envío lo hace el job Python vía Resend; no hay Edge Function.

Frecuencias (ADR 013):

- daily: drena siempre que haya ítems drainable.
- weekly: solo lunes UTC; el resto deja pending/failed.
- instant: fuera del MVP.

Reintentos de cola (sin ADR): tras un fallo, ``failed`` sigue siendo drainable
hasta agotar el umbral del error actual; luego ``cancelled``.

Plantilla: título + «Ver en EfiLicit» + «Fuente oficial» (URL leída de
``tender_sources`` al montar el correo; no se duplica en el payload de cola).
"""

from __future__ import annotations

import os
from collections import defaultdict
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Any, Callable

from efilicit_ingestion.alerts.email import EmailMessage, EmailSender
from efilicit_ingestion.alerts.inbox import DigestInbox, tender_ids_from_items
from efilicit_ingestion.alerts.models import NotificationItem
from efilicit_ingestion.alerts.queue import (
    NotificationQueue,
    digest_day,
    should_send_digest,
)

# Marca EfiLicit (email: tablas + CSS inline; sin Geist embebido).
_BRAND = "#52b9d8"
_BRAND_BORDER = "#b3e3f0"
_BG = "#f7fbfd"
_TEXT = "#1a2b33"
_MUTED = "#5a6f78"
_MAX_VISIBLE = 10


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
    """Resuelve ``public.users.id`` → email / display_name (solo trusted)."""

    emails: dict[str, str] = field(default_factory=dict)
    display_names: dict[str, str] = field(default_factory=dict)

    def email_for(self, user_id: str) -> str | None:
        return self.emails.get(user_id)

    def display_name_for(self, user_id: str, *, email: str | None = None) -> str:
        name = (self.display_names.get(user_id) or "").strip()
        if name:
            return name
        if email and "@" in email:
            local = email.split("@", 1)[0].strip()
            if local:
                return local
        return "usuario"


def app_base_url() -> str:
    """Base de la web para deep-links (``EFILICIT_APP_URL``)."""
    return (os.environ.get("EFILICIT_APP_URL") or "").strip().rstrip("/")


def build_digest_message(
    *,
    to_email: str,
    digest: str,
    items: list[NotificationItem],
    frequency: str = "diaria",
    display_name: str = "usuario",
    base_url: str | None = None,
    source_urls: Mapping[str, str] | None = None,
) -> EmailMessage:
    """Plantilla branded: título + EfiLicit + fuente oficial (si hay URL)."""
    from efilicit_ingestion.alerts.queue import normalize_digest_frequency

    count = len(items)
    freq = normalize_digest_frequency(frequency)
    label = "semanal" if freq == "semanal" else "diario"
    subject = _subject_line(label=label, count=count)
    base = (base_url if base_url is not None else app_base_url()).rstrip("/")
    name = (display_name or "usuario").strip() or "usuario"
    urls = dict(source_urls or {})

    text = _build_text(
        name=name,
        label=label,
        count=count,
        items=items,
        base=base,
        source_urls=urls,
    )
    html = _build_html(
        name=name,
        label=label,
        count=count,
        items=items,
        base=base,
        source_urls=urls,
    )
    return EmailMessage(
        to=to_email,
        subject=subject,
        text=text,
        html=html,
        tags=("digest", freq, digest),
    )


def _subject_line(*, label: str, count: int) -> str:
    if count == 1:
        return f"EfiLicit resumen {label}: 1 oportunidad nueva"
    return f"EfiLicit resumen {label}: {count} oportunidades nuevas"


def _build_text(
    *,
    name: str,
    label: str,
    count: int,
    items: list[NotificationItem],
    base: str,
    source_urls: Mapping[str, str],
) -> str:
    lines = [
        f"EfiLicit — Resumen {label}",
        "",
        f"Hola, {name}",
        f"Tienes {count} nuevas coincidencias con tus alertas.",
        "",
    ]
    visible = items[:_MAX_VISIBLE]
    for item in visible:
        title = _item_title(item.payload)
        tid = _item_tender_id(item.payload)
        lines.append(f"- {title}")
        if base and tid:
            lines.append(f"  Ver en EfiLicit: {base}/tenders/{tid}")
        src = source_urls.get(tid) if tid else None
        if src:
            lines.append(f"  Fuente oficial: {src}")
        lines.append("")
    remaining = count - len(visible)
    if remaining > 0:
        lines.append(f"… y {remaining} más.")
        lines.append("")
    if base:
        lines.append(f"Ver todas en el buzón: {base}/notifications")
    return "\n".join(lines).rstrip() + "\n"


def _build_html(
    *,
    name: str,
    label: str,
    count: int,
    items: list[NotificationItem],
    base: str,
    source_urls: Mapping[str, str],
) -> str:
    cards = "".join(
        _item_card(
            item.payload,
            base=base,
            source_url=source_urls.get(_item_tender_id(item.payload) or ""),
        )
        for item in items[:_MAX_VISIBLE]
    )
    remaining = count - min(count, _MAX_VISIBLE)
    more_html = ""
    if remaining > 0:
        more_html = (
            f'<p style="margin:16px 0 0;font-size:14px;color:{_MUTED};">'
            f"… y {_escape(str(remaining))} más."
            f"</p>"
        )

    inbox_cta = ""
    if base:
        inbox_cta = (
            f'<p style="margin:24px 0 0;text-align:center;">'
            f'<a href="{_escape(base)}/notifications" '
            f'style="display:inline-block;padding:10px 18px;background:{_BRAND};'
            f'color:#ffffff;text-decoration:none;border-radius:6px;'
            f'font-size:14px;font-weight:600;">Ver todas en el buzón</a>'
            f"</p>"
        )

    greeting = (
        f'<p style="margin:0 0 8px;font-size:16px;color:{_TEXT};">'
        f"Hola, {_escape(name)}</p>"
        f'<p style="margin:0 0 20px;font-size:15px;color:{_TEXT};line-height:1.45;">'
        f"Tienes <strong>{count}</strong> nuevas coincidencias con tus alertas."
        f"</p>"
    )

    return f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:{_BG};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{_BG};">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid {_BRAND_BORDER};border-radius:10px;overflow:hidden;">
        <tr>
          <td style="background:{_BRAND};padding:18px 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;letter-spacing:-0.02em;">
                  <span style="color:#ffffff;">Efi</span><span style="color:#d9eef5;">Licit</span>
                </td>
                <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#ffffff;opacity:0.95;">
                  Resumen {label}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;font-family:Arial,Helvetica,sans-serif;background:{_BG};">
            {greeting}
            {cards}
            {more_html}
            {inbox_cta}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>"""


def _item_card(
    payload: Mapping[str, Any],
    *,
    base: str,
    source_url: str | None,
) -> str:
    title = _escape(_item_title(payload))
    tid = _item_tender_id(payload)

    actions: list[str] = []
    if base and tid:
        href = f"{base}/tenders/{tid}"
        actions.append(
            f'<a href="{_escape(href)}" '
            f'style="display:inline-block;padding:8px 14px;background:{_BRAND};'
            f'color:#ffffff;text-decoration:none;border-radius:6px;'
            f'font-size:13px;font-weight:600;">Ver en EfiLicit</a>'
        )
    if source_url:
        actions.append(
            f'<a href="{_escape(source_url)}" '
            f'style="display:inline-block;padding:8px 4px;color:{_BRAND};'
            f'text-decoration:underline;font-size:13px;font-weight:600;">'
            f"Fuente oficial</a>"
        )

    actions_html = ""
    if actions:
        actions_html = (
            f'<p style="margin:12px 0 0;line-height:1.6;">'
            f'{"&nbsp;&nbsp;".join(actions)}'
            f"</p>"
        )

    return (
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        f'style="margin:0 0 12px;background:#ffffff;border:1px solid {_BRAND_BORDER};'
        f'border-radius:8px;">'
        f'<tr><td style="padding:14px 16px;">'
        f'<p style="margin:0;font-size:15px;font-weight:600;color:{_TEXT};'
        f'line-height:1.35;">{title}</p>'
        f"{actions_html}"
        f"</td></tr></table>"
    )


def _item_title(payload: Mapping[str, Any]) -> str:
    return str(payload.get("title") or payload.get("tender_id") or "licitación")


def _item_tender_id(payload: Mapping[str, Any]) -> str:
    return str(payload.get("tender_id") or "").strip()


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


def _tender_ids_for_items(items: list[NotificationItem]) -> list[str]:
    ids: list[str] = []
    seen: set[str] = set()
    for item in items:
        tid = _item_tender_id(item.payload)
        if tid and tid not in seen:
            seen.add(tid)
            ids.append(tid)
    return ids


def drain_daily_digests(
    *,
    queue: NotificationQueue,
    sender: EmailSender,
    directory: UserEmailDirectory,
    list_pending: Callable[[], list[NotificationItem]] | None = None,
    frequencies: Mapping[str, str] | None = None,
    job_date: date | datetime | None = None,
    inbox: DigestInbox | None = None,
    resolve_source_urls: Callable[[list[str]], Mapping[str, str]] | None = None,
) -> DigestDrainResult:
    """Envía un digest por (usuario, periodo) cuando toca según la frecuencia.

    - daily: siempre que haya ítems drainable.
    - weekly: solo lunes UTC; el resto de días no envía.
    Reejecutar tras un envío OK no reenvía: los ítems ya no están drainable.
    Tras fallo: ``failed`` reintentable o ``cancelled`` si agota el umbral.
    Si ``inbox`` está definido, materializa un aviso in-app (1 = 1 correo).
    ``resolve_source_urls``: lookup puntual de URLs oficiales (``tender_sources``).
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
    base = app_base_url()

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

        source_urls: Mapping[str, str] = {}
        if resolve_source_urls is not None:
            source_urls = resolve_source_urls(_tender_ids_for_items(items))

        message = build_digest_message(
            to_email=to_email,
            digest=digest,
            items=items,
            frequency=freq,
            display_name=directory.display_name_for(user_id, email=to_email),
            base_url=base,
            source_urls=source_urls,
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
