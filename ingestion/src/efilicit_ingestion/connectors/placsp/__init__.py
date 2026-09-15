"""PLACSP connector (Atom/CODICE syndications)."""

from efilicit_ingestion.connectors.placsp.connector import PlacspConnector, sha256_hex
from efilicit_ingestion.connectors.placsp.parser import PlacspParseError
from efilicit_ingestion.connectors.placsp.urls import PLACSP, PLACSP_AGREGADAS, PlacspSyndication

__all__ = [
    "PlacspConnector",
    "PlacspParseError",
    "PlacspSyndication",
    "PLACSP",
    "PLACSP_AGREGADAS",
    "sha256_hex",
]
