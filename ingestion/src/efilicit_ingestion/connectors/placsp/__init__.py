"""PLACSP connector (Semana 2 vertical slice)."""

from efilicit_ingestion.connectors.placsp.connector import PlacspConnector, sha256_hex
from efilicit_ingestion.connectors.placsp.parser import PlacspParseError

__all__ = ["PlacspConnector", "PlacspParseError", "sha256_hex"]
