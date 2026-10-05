"""Errores del adaptador REST Euskadi / KontratazioA.

Mensajes de excepción en inglés; tipado para tests/logs. Sin escritura
en ``public.errors`` (ADR 003).
"""

from __future__ import annotations


class EuskadiFetchError(Exception):
    """Error base al descargar un recurso de procurements Euskadi."""


class EuskadiHttpError(EuskadiFetchError):
    """Respuesta HTTP no exitosa de la API."""

    def __init__(self, status_code: int, url: str) -> None:
        self.status_code = status_code
        self.url = url
        super().__init__(f"HTTP {status_code} fetching {url}")


class ArtifactTooLargeError(EuskadiFetchError):
    """El cuerpo descargado supera el presupuesto de tamaño."""


class EuskadiParseError(ValueError):
    """Payload JSON inválido para un artefacto Euskadi."""
