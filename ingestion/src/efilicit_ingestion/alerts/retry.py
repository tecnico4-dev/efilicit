"""Política de reintento de ``notification_queue`` tras fallos de envío.

Sin ADR: refinamiento operativo de la cola MVP. Umbrales por clase de error
evaluados en cada fallo (``attempts`` solo sube; no se guarda un MAX fijo).

- Temporal (red, 5xx, 429, …): reintentable mientras ``attempts < 3``.
- Gordo (sin email, secretos, 4xx de cliente, …): mientras ``attempts < 2``.
- Agotado → ``cancelled`` (el job automático no lo vuelve a coger).
"""

from __future__ import annotations

from typing import Literal

ErrorClass = Literal["transient", "hard"]

MAX_ATTEMPTS_TRANSIENT = 3
MAX_ATTEMPTS_HARD = 2


def classify_send_error(error: str) -> ErrorClass:
    """Clasifica el mensaje de error del último intento de envío."""
    text = (error or "").strip()
    if not text:
        return "transient"

    if text.startswith("no_email_for_user:"):
        return "hard"
    if text in {"RESEND_API_KEY missing", "ALERT_FROM_EMAIL missing"}:
        return "hard"

    # Resend HTTP: 429 y 5xx → temporal; resto de 4xx → gordo.
    if text.startswith("resend_http_"):
        rest = text.removeprefix("resend_http_")
        code_str = rest.split(":", 1)[0].strip()
        try:
            code = int(code_str)
        except ValueError:
            return "transient"
        if code == 429 or code >= 500:
            return "transient"
        if 400 <= code < 500:
            return "hard"
        return "transient"

    return "transient"


def max_attempts_for_error(error: str) -> int:
    """Umbral exclusivo: si ``attempts >=`` este valor → ``cancelled``."""
    if classify_send_error(error) == "hard":
        return MAX_ATTEMPTS_HARD
    return MAX_ATTEMPTS_TRANSIENT


def status_after_failed_attempt(*, attempts: int, error: str) -> str:
    """Estado tras incrementar ``attempts`` con el ``error`` actual."""
    if attempts < max_attempts_for_error(error):
        return "failed"
    return "cancelled"
