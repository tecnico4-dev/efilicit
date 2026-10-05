"""Errores del adaptador HTTP Socrata / SODA.

Los mensajes de excepción permanecen en inglés; estas clases tipan el fallo
para tests y logs. No se escriben en ``public.errors`` (ADR 003).
"""

from __future__ import annotations


class SocrataFetchError(Exception):
    """Error base al descargar un recurso Socrata."""


class SocrataHttpError(SocrataFetchError):
    """Respuesta HTTP no exitosa del dominio SODA."""

    def __init__(self, status_code: int, url: str) -> None:
        self.status_code = status_code
        self.url = url
        super().__init__(f"HTTP {status_code} fetching {url}")


class ArtifactTooLargeError(SocrataFetchError):
    """El cuerpo descargado supera el presupuesto de tamaño."""


class SocrataParseError(ValueError):
    """Payload JSON inválido para un artefacto Socrata."""
