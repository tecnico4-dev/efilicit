"""Connector package: SourceConnector protocol and stubs."""

from efilicit_ingestion.connectors.protocol import SourceConnector
from efilicit_ingestion.connectors.stub import StubSourceConnector

__all__ = ["SourceConnector", "StubSourceConnector"]
