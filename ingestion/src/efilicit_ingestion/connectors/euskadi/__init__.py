"""Conector Euskadi / KontratazioA REST (Semana 3 Paso 9)."""

from efilicit_ingestion.connectors.euskadi.connector import EuskadiConnector, sha256_hex
from efilicit_ingestion.connectors.euskadi.errors import (
    EuskadiFetchError,
    EuskadiHttpError,
    EuskadiParseError,
)
from efilicit_ingestion.connectors.euskadi.urls import EUSKADI, EuskadiDataset

__all__ = [
    "EuskadiConnector",
    "EuskadiDataset",
    "EUSKADI",
    "EuskadiFetchError",
    "EuskadiHttpError",
    "EuskadiParseError",
    "sha256_hex",
]
