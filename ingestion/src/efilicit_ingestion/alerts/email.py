"""Envío de email para digests (Paso 8). API key solo en backend/env — nunca en frontend."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any, Protocol

import httpx


@dataclass(frozen=True, slots=True)
class EmailMessage:
    to: str
    subject: str
    text: str
    html: str | None = None
    tags: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class EmailSendResult:
    ok: bool
    provider_id: str | None = None
    error: str | None = None


class EmailSender(Protocol):
    def send(self, message: EmailMessage) -> EmailSendResult: ...


@dataclass
class FakeEmailSender:
    """Captura emails en memoria (tests / dry-run sin Resend)."""

    sent: list[EmailMessage] = field(default_factory=list)
    fail_next: bool = False

    def send(self, message: EmailMessage) -> EmailSendResult:
        if self.fail_next:
            self.fail_next = False
            return EmailSendResult(ok=False, error="fake_sender_forced_failure")
        self.sent.append(message)
        return EmailSendResult(ok=True, provider_id=f"fake-{len(self.sent)}")


class ResendEmailSender:
    """Cliente mínimo Resend vía HTTP (secretos desde entorno)."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        from_email: str | None = None,
        timeout_s: float = 30.0,
    ) -> None:
        self._api_key = api_key or os.environ.get("RESEND_API_KEY", "")
        self._from = from_email or os.environ.get("ALERT_FROM_EMAIL", "")
        self._timeout_s = timeout_s

    def send(self, message: EmailMessage) -> EmailSendResult:
        if not self._api_key:
            return EmailSendResult(ok=False, error="RESEND_API_KEY missing")
        if not self._from:
            return EmailSendResult(ok=False, error="ALERT_FROM_EMAIL missing")

        body: dict[str, Any] = {
            "from": self._from,
            "to": [message.to],
            "subject": message.subject,
            "text": message.text,
        }
        if message.html:
            body["html"] = message.html
        if message.tags:
            # Resend exige nombres de tag únicos por email (no repetir "efilicit").
            body["tags"] = [
                {"name": f"efilicit_{i}", "value": str(t)[:256]}
                for i, t in enumerate(message.tags)
            ]

        try:
            response = httpx.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json=body,
                timeout=self._timeout_s,
            )
        except httpx.HTTPError as exc:
            return EmailSendResult(ok=False, error=str(exc))

        if response.status_code >= 400:
            return EmailSendResult(
                ok=False,
                error=f"resend_http_{response.status_code}: {response.text[:500]}",
            )

        data = response.json() if response.content else {}
        return EmailSendResult(ok=True, provider_id=str(data.get("id") or ""))
