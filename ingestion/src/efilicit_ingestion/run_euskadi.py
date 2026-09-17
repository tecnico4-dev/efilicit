"""Run Euskadi (KontratazioA) ingestion end-to-end (Semana 3 Paso 9)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from pathlib import Path

from efilicit_ingestion.connectors.euskadi import EUSKADI, EuskadiConnector, EuskadiDataset
from efilicit_ingestion.models import SyncContext
from efilicit_ingestion.pipeline.canonical_repo import (
    InMemoryCanonicalRepository,
    PostgresCanonicalRepository,
)
from efilicit_ingestion.pipeline.ports import InMemoryArtifactStore, InMemorySyncRepository
from efilicit_ingestion.pipeline.postgres import PostgresSyncRepository, connect
from efilicit_ingestion.pipeline.runner import run_pipeline
from efilicit_ingestion.pipeline.supabase_storage import (
    SupabaseStorageArtifactStore,
    default_service_role_key,
    default_supabase_url,
)
from efilicit_ingestion.pipeline.types import PipelineResult
from efilicit_ingestion.run_placsp import format_result

__all__ = [
    "EuskadiRunConfig",
    "run_euskadi",
    "format_result",
    "load_fixture_bytes",
]


@dataclass(frozen=True)
class EuskadiRunConfig:
    fixture_path: Path | None = None
    max_pages: int = 1
    start_page: int = 1
    dry_run: bool = False
    run_id: str | None = None
    use_storage: bool = True
    dataset: EuskadiDataset = EUSKADI


def load_fixture_bytes(path: Path) -> bytes:
    raw = path.read_bytes()
    if path.suffix.lower() != ".json":
        raise ValueError(f"unsupported fixture type (expected .json): {path}")
    if b'"items"' not in raw:
        raise ValueError(f"fixture must be a KontratazioA page with items[]: {path}")
    return raw


def run_euskadi(config: EuskadiRunConfig) -> PipelineResult:
    """Execute discover→…→upsert for Euskadi contracting-notices pages."""
    dataset = config.dataset
    run_id = config.run_id or f"{dataset.source_code}-{uuid.uuid4()}"

    fetch_transport = None
    if config.fixture_path is not None:
        fixture_bytes = load_fixture_bytes(config.fixture_path)
        fetch_transport = lambda url, data=fixture_bytes: (
            200,
            {"content-type": "application/json", "content-length": str(len(data))},
            data,
        )

    connector = EuskadiConnector(
        dataset=dataset,
        max_pages=config.max_pages,
        start_page=config.start_page,
        fetch_transport=fetch_transport,
    )
    context = SyncContext(source_code=connector.source_code, run_id=run_id)

    if config.dry_run:
        return run_pipeline(
            connector,
            context,
            artifact_store=InMemoryArtifactStore(),
            sync_repo=InMemorySyncRepository(),
            canonical_repo=InMemoryCanonicalRepository(),
        )

    if config.use_storage:
        key = default_service_role_key()
        if not key:
            raise RuntimeError(
                "SUPABASE_SERVICE_ROLE_KEY is required for Storage uploads "
                "(or pass dry_run=True / use_storage=False)."
            )
        artifact_store: object = SupabaseStorageArtifactStore(
            base_url=default_supabase_url(),
            service_role_key=key,
        )
    else:
        artifact_store = InMemoryArtifactStore()

    with connect() as conn:
        result = run_pipeline(
            connector,
            context,
            artifact_store=artifact_store,  # type: ignore[arg-type]
            sync_repo=PostgresSyncRepository(conn),
            canonical_repo=PostgresCanonicalRepository(conn),
        )
        conn.commit()
    return result
