"""Smoke opcional: envía UN email real vía Resend (Paso 8).

Requiere secretos en el entorno (nunca en el frontend):

  RESEND_API_KEY=re_...
  ALERT_FROM_EMAIL=EfiLicit <onboarding@resend.dev>   # o tu dominio verificado
  ALERT_TO_EMAIL=tu@correo.com                        # con onboarding@resend.dev
                                                      # solo puedes enviarte a ti mismo

Uso:

  cd ingestion
  # PowerShell
  $env:RESEND_API_KEY="re_..."
  $env:ALERT_FROM_EMAIL="EfiLicit <onboarding@resend.dev>"
  $env:ALERT_TO_EMAIL="tu@correo.com"
  uv run python -m efilicit_ingestion.alerts.smoke_resend

Si faltan secretos, sale con mensaje claro (no inventa un envío falso).
"""

from __future__ import annotations

import os
import sys

from efilicit_ingestion.alerts.digest import build_digest_message
from efilicit_ingestion.alerts.email import ResendEmailSender
from efilicit_ingestion.alerts.models import NotificationItem


def main() -> int:
    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    from_email = os.environ.get("ALERT_FROM_EMAIL", "").strip()
    to_email = os.environ.get("ALERT_TO_EMAIL", "").strip()

    missing = [
        name
        for name, value in (
            ("RESEND_API_KEY", api_key),
            ("ALERT_FROM_EMAIL", from_email),
            ("ALERT_TO_EMAIL", to_email),
        )
        if not value
    ]
    if missing:
        print(
            "Faltan variables de entorno: "
            + ", ".join(missing)
            + "\nSin ellas no se puede comprobar Resend de verdad "
            "(usa FakeEmailSender en pytest).",
            file=sys.stderr,
        )
        return 2

    sample = NotificationItem(
        user_id="smoke-user",
        alert_id="smoke-alert",
        idempotency_key="smoke:resend",
        payload={
            "title": "Mantenimiento de software (smoke EfiLicit)",
            "tender_id": "smoke-tender",
            "digest": "smoke",
        },
    )
    message = build_digest_message(
        to_email=to_email,
        digest="smoke",
        items=[sample],
    )
    # Prefijo claro para no confundirlo con un digest de producción
    message = type(message)(
        to=message.to,
        subject=f"[SMOKE] {message.subject}",
        text=message.text + "\n\n(Este es un smoke manual de Semana 5 Paso 8.)\n",
        html=message.html,
        tags=("smoke", "digest"),
    )

    result = ResendEmailSender(api_key=api_key, from_email=from_email).send(message)
    if not result.ok:
        print(f"Resend FALLÓ: {result.error}", file=sys.stderr)
        return 1

    print(f"Resend OK — provider_id={result.provider_id}")
    print(f"Revisa la bandeja de {to_email} (y spam).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
