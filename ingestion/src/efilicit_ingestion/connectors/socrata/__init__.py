"""Familia de conector Socrata / SODA (Semana 3 Paso 7).

SODA pagina con ``$limit`` / ``$offset``: no hay ZIP mensual como en PLACSP.
Cada página JSON se trata como un artefacto RAW con ``artifact_key`` estable
(offset+limit), se guarda en Storage y luego se parsea a ``SourceRecord``.

Preset por defecto: Transparència Catalunya ``ybgg-dgi6`` (publicaciones PSCP).
El conector es reutilizable para otros datasets Socrata; el mapeo de campos
actual del parser es el de Catalunya.
"""

from efilicit_ingestion.connectors.socrata.connector import SocrataConnector, sha256_hex
from efilicit_ingestion.connectors.socrata.errors import (
    SocrataFetchError,
    SocrataHttpError,
    SocrataParseError,
)
from efilicit_ingestion.connectors.socrata.urls import CATALUNYA, SocrataDataset

__all__ = [
    "SocrataConnector",
    "SocrataDataset",
    "CATALUNYA",
    "SocrataFetchError",
    "SocrataHttpError",
    "SocrataParseError",
    "sha256_hex",
]
