"""Digest diario/semanal: agrupa drainable y envía un email por usuario (Paso 8).

Batch-first (ADR 012): un correo por usuario cuando toca según su frecuencia
de cuenta, no por cada INSERT de ingesta. El envío lo hace el job Python vía
Resend; no hay Edge Function.

Frecuencias (ADR 013):

- daily: drena siempre que haya ítems drainable.
- weekly: solo lunes UTC; el resto deja pending/failed.
- instant: fuera del MVP.

Agrupación al enviar: por ``user_id``. Así un
cambio diaria↔semanal no genera varios correos por periodos viejos en cola.
El periodo del aviso in-app / tags es el de la frecuencia actual + ``job_date``.

Reintentos de cola (sin ADR): tras un fallo, ``failed`` sigue siendo drainable
hasta agotar el umbral del error actual; luego ``cancelled``.

Plantilla: bloques por alerta (máx. 5 alertas × 5 ítems) + «Ver en EfiLicit»
+ «Fuente oficial» (URL leída de ``tender_sources`` al montar el correo).
"""

from __future__ import annotations

import os
from collections import defaultdict
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Any, Callable

from efilicit_ingestion.alerts.email import EmailMessage, EmailSender
from efilicit_ingestion.alerts.inbox import DigestInbox, tender_ids_from_items
from efilicit_ingestion.alerts.models import NotificationItem
from efilicit_ingestion.alerts.queue import (
    NotificationQueue,
    digest_period,
    should_send_digest,
)

# Marca EfiLicit (email: tablas + CSS inline; sin Geist embebido).
_BRAND = "#52b9d8"
_BRAND_BORDER = "#b3e3f0"
_BG = "#f7fbfd"
_TEXT = "#1a2b33"
_MUTED = "#5a6f78"
_MAX_PER_ALERT = 5
_MAX_ALERTS = 5


@dataclass(frozen=True)
class _AlertDigestBlock:
    alert_id: str
    name: str
    items: tuple[NotificationItem, ...]
    total: int
    kind: str | None = None  # propia | subcontrata | None


# Colores burbuja alineados con favoritos web (teal / violeta).
_KIND_EFICEN_BORDER = "rgba(13,148,136,0.35)"
_KIND_EFICEN_BG = "rgba(13,148,136,0.12)"
_KIND_EFICEN_TEXT = "#115e59"
_KIND_SUB_BORDER = "rgba(139,92,246,0.35)"
_KIND_SUB_BG = "rgba(139,92,246,0.12)"
_KIND_SUB_TEXT = "#5b21b6"


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
    alert_names: Mapping[str, str] | None = None,
    alert_kinds: Mapping[str, str | None] | None = None,
) -> EmailMessage:
    """Plantilla branded: máx. N alertas × M ítems + CTAs (cola se marca entera).

    Bloques agrupados por alerta; orden: Eficen → Subcontrata → sin clasificar
    (estable dentro de cada grupo). Sin ``kind`` no hay burbuja.
    """
    from efilicit_ingestion.alerts.queue import normalize_digest_frequency

    count = len(items)
    freq = normalize_digest_frequency(frequency)
    label = "semanal" if freq == "semanal" else "diario"
    subject = _subject_line(label=label, count=count)
    base = (base_url if base_url is not None else app_base_url()).rstrip("/")
    name = (display_name or "usuario").strip() or "usuario"
    urls = dict(source_urls or {})
    names = dict(alert_names or {})
    kinds = dict(alert_kinds or {})
    all_blocks = group_items_by_alert(
        items, alert_names=names, alert_kinds=kinds
    )
    all_blocks = _sort_blocks_by_kind(all_blocks)
    total_alerts = len(all_blocks)
    blocks = all_blocks[:_MAX_ALERTS]
    omitted_alerts = total_alerts - len(blocks)

    text = _build_text(
        name=name,
        label=label,
        count=count,
        total_alerts=total_alerts,
        blocks=blocks,
        omitted_alerts=omitted_alerts,
        base=base,
        source_urls=urls,
    )
    html = _build_html(
        name=name,
        label=label,
        count=count,
        total_alerts=total_alerts,
        blocks=blocks,
        omitted_alerts=omitted_alerts,
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


def group_items_by_alert(
    items: Sequence[NotificationItem],
    *,
    alert_names: Mapping[str, str] | None = None,
    alert_kinds: Mapping[str, str | None] | None = None,
    max_per_alert: int = _MAX_PER_ALERT,
) -> list[_AlertDigestBlock]:
    """Agrupa por alerta; conserva orden de primera aparición; recorta ítems por bloque.

    El tope de nº de alertas visibles y el orden Eficen/Sub lo aplica
    ``build_digest_message``.
    """
    names = dict(alert_names or {})
    kinds = dict(alert_kinds or {})
    order: list[str] = []
    buckets: dict[str, list[NotificationItem]] = defaultdict(list)
    for item in items:
        aid = (item.alert_id or _item_alert_id(item.payload) or "").strip() or "_unknown"
        if aid not in buckets:
            order.append(aid)
        buckets[aid].append(item)

    blocks: list[_AlertDigestBlock] = []
    for aid in order:
        group = buckets[aid]
        label = (
            names.get(aid)
            or _item_alert_name(group[0].payload)
            or ("Alerta" if aid == "_unknown" else "Alerta")
        )
        raw_kind = kinds.get(aid)
        kind = raw_kind if raw_kind in ("propia", "subcontrata") else None
        visible = tuple(group[:max_per_alert])
        blocks.append(
            _AlertDigestBlock(
                alert_id=aid,
                name=label,
                items=visible,
                total=len(group),
                kind=kind,
            )
        )
    return blocks


def _kind_sort_rank(kind: str | None) -> int:
    if kind == "propia":
        return 0
    if kind == "subcontrata":
        return 1
    return 2


def _sort_blocks_by_kind(
    blocks: Sequence[_AlertDigestBlock],
) -> list[_AlertDigestBlock]:
    """Eficen → Subcontrata → sin clasificar; estable dentro de cada grupo."""
    indexed = list(enumerate(blocks))
    indexed.sort(key=lambda pair: (_kind_sort_rank(pair[1].kind), pair[0]))
    return [block for _, block in indexed]


def _kind_label(kind: str | None) -> str | None:
    if kind == "propia":
        return "Eficen"
    if kind == "subcontrata":
        return "Subcontrata"
    return None


def _kind_bubble_html(kind: str | None) -> str:
    label = _kind_label(kind)
    if not label:
        return ""
    if kind == "propia":
        border, bg, color = _KIND_EFICEN_BORDER, _KIND_EFICEN_BG, _KIND_EFICEN_TEXT
    else:
        border, bg, color = _KIND_SUB_BORDER, _KIND_SUB_BG, _KIND_SUB_TEXT
    return (
        f'<span style="display:inline-block;padding:2px 8px;border-radius:999px;'
        f"border:1px solid {border};background:{bg};"
        f'font-size:11px;font-weight:600;color:{color};line-height:1.4;'
        f'font-family:Arial,Helvetica,sans-serif;">{_escape(label)}</span>'
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
    total_alerts: int,
    blocks: Sequence[_AlertDigestBlock],
    omitted_alerts: int,
    base: str,
    source_urls: Mapping[str, str],
) -> str:
    alert_bit = (
        "1 alerta"
        if total_alerts == 1
        else f"{total_alerts} alertas"
    )
    lines = [
        f"EfiLicit — Resumen {label}",
        "",
        f"Hola, {name}",
        f"Tienes {count} nuevas coincidencias en {alert_bit}.",
        "",
    ]
    for i, block in enumerate(blocks):
        kind_bit = _kind_label(block.kind)
        heading = f"## {block.name}" + (f" ({kind_bit})" if kind_bit else "")
        lines.append(heading)
        for item in block.items:
            title = _item_title(item.payload)
            tid = _item_tender_id(item.payload)
            lines.append(f"- {title}")
            if base and tid:
                href = _tender_detail_href(base, tid, interest=block.kind)
                lines.append(f"  Ver en EfiLicit: {href}")
            src = source_urls.get(tid) if tid else None
            if src:
                lines.append(f"  Fuente oficial: {src}")
        remaining = block.total - len(block.items)
        if remaining > 0:
            lines.append(f"… y {remaining} más en esta alerta.")
        lines.append("")
        # Hueco extra entre bloques de alerta (antes del siguiente título).
        if i < len(blocks) - 1:
            lines.append("")
    if omitted_alerts > 0:
        more = (
            "1 alerta más"
            if omitted_alerts == 1
            else f"{omitted_alerts} alertas más"
        )
        lines.append(f"… y {more} en el buzón.")
        lines.append("")
    if base:
        lines.append(f"Ver todas en el buzón: {base}/notifications")
    return "\n".join(lines).rstrip() + "\n"


def _build_html(
    *,
    name: str,
    label: str,
    count: int,
    total_alerts: int,
    blocks: Sequence[_AlertDigestBlock],
    omitted_alerts: int,
    base: str,
    source_urls: Mapping[str, str],
) -> str:
    # Spacer con height/padding (no margin): Gmail/Outlook suelen ignorar margin en <table>.
    section_parts: list[str] = []
    for i, block in enumerate(blocks):
        if i > 0:
            section_parts.append(_alert_block_spacer())
        section_parts.append(_alert_section(block, base=base, source_urls=source_urls))
    sections = "".join(section_parts)

    omitted_html = ""
    if omitted_alerts > 0:
        more = (
            "1 alerta más"
            if omitted_alerts == 1
            else f"{omitted_alerts} alertas más"
        )
        omitted_html = (
            f'<p style="margin:0 0 16px;font-size:13px;color:{_MUTED};">'
            f"… y {_escape(more)} en el buzón."
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

    alert_bit = "1 alerta" if total_alerts == 1 else f"{total_alerts} alertas"
    greeting = (
        f'<p style="margin:0 0 8px;font-size:16px;color:{_TEXT};">'
        f"Hola, {_escape(name)}</p>"
        f'<p style="margin:0 0 20px;font-size:15px;color:{_TEXT};line-height:1.45;">'
        f"Tienes <strong>{count}</strong> nuevas coincidencias en {_escape(alert_bit)}."
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
            {sections}
            {omitted_html}
            {inbox_cta}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>"""


def _alert_block_spacer() -> str:
    """Hueco vertical entre bloques de alerta (compatible con clientes de email)."""
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">'
        '<tr><td height="28" style="height:28px;line-height:28px;font-size:0;">&nbsp;</td></tr>'
        "</table>"
    )


def _alert_section(
    block: _AlertDigestBlock,
    *,
    base: str,
    source_urls: Mapping[str, str],
) -> str:
    cards = "".join(
        _item_card(
            item.payload,
            base=base,
            source_url=source_urls.get(_item_tender_id(item.payload) or ""),
            interest=block.kind,
        )
        for item in block.items
    )
    remaining = block.total - len(block.items)
    more_html = ""
    if remaining > 0:
        more_html = (
            f'<p style="margin:8px 0 0;font-size:13px;color:{_MUTED};">'
            f"… y {_escape(str(remaining))} más en esta alerta."
            f"</p>"
        )
    coincidences = (
        f"{block.total} coincidencia{'s' if block.total != 1 else ''}"
    )
    bubble = _kind_bubble_html(block.kind)
    meta_row = (
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0">'
        f"<tr>"
        f'<td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;'
        f'color:{_MUTED};vertical-align:middle;">{coincidences}</td>'
    )
    if bubble:
        meta_row += (
            f'<td align="right" style="vertical-align:middle;white-space:nowrap;'
            f'padding-left:12px;">{bubble}</td>'
        )
    meta_row += "</tr></table>"
    return (
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        f'style="margin:0;">'
        f'<tr><td style="padding:0 0 10px;border-bottom:2px solid {_BRAND_BORDER};">'
        f'<p style="margin:0;font-size:16px;font-weight:700;color:{_TEXT};">'
        f"{_escape(block.name)}</p>"
        f'<div style="margin:4px 0 0;">{meta_row}</div>'
        f"</td></tr>"
        f'<tr><td style="padding:12px 0 0;">{cards}{more_html}</td></tr>'
        f"</table>"
    )


def _tender_detail_href(
    base: str, tender_id: str, *, interest: str | None = None
) -> str:
    href = f"{base}/tenders/{tender_id}?from=email"
    if interest in ("propia", "subcontrata"):
        href = f"{href}&interest={interest}"
    return href


def _item_card(
    payload: Mapping[str, Any],
    *,
    base: str,
    source_url: str | None,
    interest: str | None = None,
) -> str:
    title = _escape(_item_title(payload))
    tid = _item_tender_id(payload)

    actions: list[str] = []
    if base and tid:
        href = _tender_detail_href(base, tid, interest=interest)
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


def _item_alert_id(payload: Mapping[str, Any]) -> str:
    return str(payload.get("alert_id") or "").strip()


def _item_alert_name(payload: Mapping[str, Any]) -> str:
    return str(payload.get("alert_name") or "").strip()


def _escape(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def group_drainable_by_user(
    items: list[NotificationItem],
) -> dict[str, list[NotificationItem]]:
    """Agrupa ``pending``/``failed`` por usuario → un solo email cuando toque."""
    groups: dict[str, list[NotificationItem]] = defaultdict(list)
    for item in items:
        if item.status not in {"pending", "failed"}:
            continue
        groups[item.user_id].append(item)
    return dict(groups)


# Compat: nombre antiguo (antes agrupaba también por periodo en payload).
group_drainable_by_user_digest = group_drainable_by_user
group_pending_by_user_digest = group_drainable_by_user


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
    resolve_alert_names: Callable[[list[str]], Mapping[str, str]] | None = None,
    resolve_alert_kinds: Callable[[list[str]], Mapping[str, str | None]]
    | None = None,
) -> DigestDrainResult:
    """Envía un digest por usuario cuando toca según la frecuencia de cuenta.

    - daily: siempre que haya ítems drainable.
    - weekly: solo lunes UTC; el resto de días no envía.
    Un usuario = un correo. El periodo del job etiqueta inbox/tags; no reencola.
    Reejecutar tras un envío OK no reenvía: los ítems ya no están drainable.
    Tras fallo: ``failed`` reintentable o ``cancelled`` si agota el umbral.
    Si ``inbox`` está definido, materializa un aviso in-app (1 = 1 correo).
    ``resolve_source_urls``: lookup puntual de URLs oficiales (``tender_sources``).
    ``resolve_alert_names``: nombres de alerta para bloques (fallback del payload).
    ``resolve_alert_kinds``: clasificación Eficen/Subcontrata por alerta.
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
    groups = group_drainable_by_user(drainable)
    result = DigestDrainResult()
    base = app_base_url()

    for user_id, items in sorted(groups.items(), key=lambda x: x[0]):
        freq = normalize_digest_frequency(
            freqs.get(user_id)
            or str(items[0].payload.get("frequency") or "diaria")
        )
        if not should_send_digest(freq, job_date):
            result.digests_skipped_not_due += 1
            continue

        # Periodo de etiqueta/inbox = cadencia actual de cuenta, no payload.
        period = digest_period(freq, job_date)

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

        alert_ids = sorted(
            {
                (item.alert_id or _item_alert_id(item.payload) or "").strip()
                for item in items
                if (item.alert_id or _item_alert_id(item.payload) or "").strip()
            }
        )
        alert_names: Mapping[str, str] = {}
        alert_kinds: Mapping[str, str | None] = {}
        if alert_ids and resolve_alert_names is not None:
            alert_names = resolve_alert_names(alert_ids)
        if alert_ids and resolve_alert_kinds is not None:
            alert_kinds = resolve_alert_kinds(alert_ids)

        message = build_digest_message(
            to_email=to_email,
            digest=period,
            items=items,
            frequency=freq,
            display_name=directory.display_name_for(user_id, email=to_email),
            base_url=base,
            source_urls=source_urls,
            alert_names=alert_names,
            alert_kinds=alert_kinds,
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
                        digest_period=period,
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
