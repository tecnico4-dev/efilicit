"""Errores del adaptador HTTP Socrata / SODA.

Clases tipadas para tests y logs. Los **mensajes** de excepción siguen en
inglés (criterio del repo). No se escriben en ``public.errors`` (ADR 003):
los fallos de corrida viven en ``source_sync`` / logs del job.
"""

from __future__ import annotations


class SocrataFetchError(Exception):
    """Error base al descargar un recurso Socrata (red, tamaño, timeout…)."""


class SocrataHttpError(SocrataFetchError):
    """Respuesta HTTP ≥400 del dominio SODA (no se reintenta como transporte)."""

    def __init__(self, status_code: int, url: str) -> None:
        self.status_code = status_code
        self.url = url
        super().__init__(f"HTTP {status_code} fetching {url}")


class ArtifactTooLargeError(SocrataFetchError):
    """Cuerpo (o Content-Length) por encima del presupuesto configurado."""


class SocrataParseError(ValueError):
    """JSON inválido o forma inesperada (p. ej. no es un array de filas)."""
