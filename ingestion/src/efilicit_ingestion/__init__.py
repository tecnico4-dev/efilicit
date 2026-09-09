"""EfiLicit ingestion package."""

from efilicit_ingestion.connectors import SourceConnector, StubSourceConnector
from efilicit_ingestion.models import RemoteArtifact, SourceRecord, SyncContext

__version__ = "0.0.0"

__all__ = [
    "RemoteArtifact",
    "SourceConnector",
    "SourceRecord",
    "StubSourceConnector",
    "SyncContext",
    "__version__",
]
