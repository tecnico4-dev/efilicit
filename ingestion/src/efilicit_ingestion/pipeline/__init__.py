"""Common ingestion pipeline (connector-agnostic)."""

from efilicit_ingestion.pipeline.ports import (
    ArtifactStore,
    InMemoryArtifactStore,
    InMemorySyncRepository,
    SyncRepository,
)
from efilicit_ingestion.pipeline.postgres import PostgresSyncRepository
from efilicit_ingestion.pipeline.raw import fetch_validate_and_store_raw
from efilicit_ingestion.pipeline.runner import run_pipeline
from efilicit_ingestion.pipeline.supabase_storage import SupabaseStorageArtifactStore
from efilicit_ingestion.pipeline.types import PipelineResult, StoredArtifact, SyncRun

__all__ = [
    "ArtifactStore",
    "InMemoryArtifactStore",
    "InMemorySyncRepository",
    "PipelineResult",
    "PostgresSyncRepository",
    "StoredArtifact",
    "SupabaseStorageArtifactStore",
    "SyncRepository",
    "SyncRun",
    "fetch_validate_and_store_raw",
    "run_pipeline",
]
