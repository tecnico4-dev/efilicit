"""Socrata / SODA connector family (Semana 3 Paso 7)."""

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
