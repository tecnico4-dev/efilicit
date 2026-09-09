"""EfiLicit ingestion package."""

from efilicit_ingestion.connectors import SourceConnector, StubSourceConnector
from efilicit_ingestion.models import RemoteArtifact, SourceRecord, SyncContext
from efilicit_ingestion.pipeline import run_pipeline

__version__ = "0.0.0"

__all__ = [
    "RemoteArtifact",
    "SourceConnector",
    "SourceRecord",
    "StubSourceConnector",
    "SyncContext",
    "__version__",
    "run_pipeline",
]
