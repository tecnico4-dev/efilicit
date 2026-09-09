"""Common ingestion pipeline (connector-agnostic)."""

from efilicit_ingestion.pipeline.ports import (
    ArtifactStore,
    InMemoryArtifactStore,
    InMemorySyncRepository,
    SyncRepository,
)
from efilicit_ingestion.pipeline.postgres import PostgresSyncRepository
from efilicit_ingestion.pipeline.runner import run_pipeline
from efilicit_ingestion.pipeline.types import PipelineResult, StoredArtifact, SyncRun

__all__ = [
    "ArtifactStore",
    "InMemoryArtifactStore",
    "InMemorySyncRepository",
    "PipelineResult",
    "PostgresSyncRepository",
    "StoredArtifact",
    "SyncRepository",
    "SyncRun",
    "run_pipeline",
]
