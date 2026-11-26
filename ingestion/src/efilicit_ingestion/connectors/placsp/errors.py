"""Errores de descarga PLACSP (controlados y clasificables).

Clases tipadas para tests/logs; **mensajes** de excepción en inglés.
No escriben en ``public.errors`` (ADR 003): el outcome del run va a ``source_sync``.
"""

from __future__ import annotations


class PlacspFetchError(Exception):
    """Error base de fallos de descarga PLACSP (red, tamaño, timeout…)."""


class ArtifactTooLargeError(PlacspFetchError):
    """ZIP (o Content-Length) por encima del presupuesto configurado."""


class PlacspHttpError(PlacspFetchError):
    """Respuesta HTTP ≥400 del host oficial de sindicación (sin reintento ciego)."""

    def __init__(self, status_code: int, url: str) -> None:
        self.status_code = status_code
        self.url = url
        super().__init__(f"HTTP {status_code} fetching {url}")


class InvalidZipPayloadError(PlacspFetchError):
    """HTTP 200 cuyo body no es un ZIP (falta magic ``PK``).

    Suele ser HTML/error intermitente de Hacienda; el fetch puede reintentar
    unas pocas veces antes de fallar el job.
    """


def placsp_source_unavailable_reason(exc: BaseException) -> str | None:
    """Si el fallo es de la plataforma (ZIP ausente/WAF), devuelve explicación.

    ``None`` = error nuestro u operativo (DB, Storage, parse…): debe seguir
    fallando el job en rojo.
    """
    if isinstance(exc, InvalidZipPayloadError):
        return (
            "PLACSP did not serve a valid ZIP (WAF/HTML or non-ZIP body after "
            "retries). Ingest skipped; next cron will retry."
        )
    if isinstance(exc, PlacspHttpError) and exc.status_code in {403, 404}:
        return (
            f"PLACSP package not available yet (HTTP {exc.status_code}). "
            "Ingest skipped; next cron will retry."
        )
    message = str(exc)
    if "missing PK header" in message:
        return (
            "PLACSP did not serve a valid ZIP (missing PK header). "
            "Ingest skipped; next cron will retry."
        )
    return None
