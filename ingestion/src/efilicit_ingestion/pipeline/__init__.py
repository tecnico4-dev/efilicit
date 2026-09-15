"""Common ingestion pipeline (connector-agnostic)."""

from efilicit_ingestion.pipeline.canonical_repo import (
    CanonicalRepository,
    InMemoryCanonicalRepository,
    PostgresCanonicalRepository,
    UpsertStats,
)
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
    "CanonicalRepository",
    "InMemoryArtifactStore",
    "InMemoryCanonicalRepository",
    "InMemorySyncRepository",
    "PipelineResult",
    "PostgresCanonicalRepository",
    "PostgresSyncRepository",
    "StoredArtifact",
    "SupabaseStorageArtifactStore",
    "SyncRepository",
    "SyncRun",
    "UpsertStats",
    "fetch_validate_and_store_raw",
    "run_pipeline",
]
