"""Pipeline común de ingesta (agnóstico del conector; Semana 1+).

Punto de import público: runner, puertos, tipos y repos. Las fuentes viven
en ``connectors.*``; este paquete no conoce PLACSP/Socrata/Euskadi.
"""

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
from efilicit_ingestion.pipeline.db_run import run_pipeline_postgres
from efilicit_ingestion.pipeline.postgres import PostgresSyncRepository
from efilicit_ingestion.pipeline.raw import fetch_validate_and_store_raw
from efilicit_ingestion.pipeline.runner import PipelineRunError, run_pipeline
from efilicit_ingestion.pipeline.supabase_storage import SupabaseStorageArtifactStore
from efilicit_ingestion.pipeline.types import PipelineResult, StoredArtifact, SyncRun

__all__ = [
    "ArtifactStore",
    "CanonicalRepository",
    "InMemoryArtifactStore",
    "InMemoryCanonicalRepository",
    "InMemorySyncRepository",
    "PipelineResult",
    "PipelineRunError",
    "PostgresCanonicalRepository",
    "PostgresSyncRepository",
    "StoredArtifact",
    "SupabaseStorageArtifactStore",
    "SyncRepository",
    "SyncRun",
    "UpsertStats",
    "fetch_validate_and_store_raw",
    "run_pipeline",
    "run_pipeline_postgres",
]
