"""Errores de descarga PLACSP (controlados y clasificables).

Los mensajes de excepción permanecen en inglés; estas clases documentan
el tipo de fallo para tests y logs. No se escriben en ``public.errors``
(ADR 003): el run falla vía ``source_sync``.
"""

from __future__ import annotations


class PlacspFetchError(Exception):
    """Error base de fallos de descarga PLACSP."""


class ArtifactTooLargeError(PlacspFetchError):
    """El payload remoto supera el presupuesto de tamaño configurado."""


class PlacspHttpError(PlacspFetchError):
    """Respuesta HTTP no exitosa del host oficial de sindicación."""

    def __init__(self, status_code: int, url: str) -> None:
        self.status_code = status_code
        self.url = url
        super().__init__(f"HTTP {status_code} fetching {url}")
