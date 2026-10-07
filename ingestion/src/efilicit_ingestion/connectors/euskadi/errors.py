"""Errores del adaptador REST Euskadi / KontratazioA.

Clases tipadas para tests/logs; mensajes de excepción en inglés.
No escriben en ``public.errors`` (ADR 003) — el outcome va a ``source_sync``.
"""

from __future__ import annotations


class EuskadiFetchError(Exception):
    """Error base al descargar un recurso de procurements Euskadi."""


class EuskadiHttpError(EuskadiFetchError):
    """Respuesta HTTP ≥400 (no se trata como reintento de transporte)."""

    def __init__(self, status_code: int, url: str) -> None:
        self.status_code = status_code
        self.url = url
        super().__init__(f"HTTP {status_code} fetching {url}")


class ArtifactTooLargeError(EuskadiFetchError):
    """Cuerpo o Content-Length por encima del presupuesto."""


class EuskadiParseError(ValueError):
    """JSON inválido o sin ``items[]`` como espera el parser."""
