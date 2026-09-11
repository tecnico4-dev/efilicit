"""Connector package: SourceConnector protocol, stubs, and real sources."""

from efilicit_ingestion.connectors.placsp import PlacspConnector
from efilicit_ingestion.connectors.protocol import SourceConnector
from efilicit_ingestion.connectors.stub import StubSourceConnector

__all__ = ["SourceConnector", "StubSourceConnector", "PlacspConnector"]