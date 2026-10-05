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
