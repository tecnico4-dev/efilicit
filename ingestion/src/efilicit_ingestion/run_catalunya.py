"""Ejecuta la ingesta Catalunya (Socrata) de punta a punta (Semana 3 Paso 8.4).

Monta el ``SocrataConnector`` + pipeline común (RAW → canónico). Sirve para:

- dry-run / fixture local (sin red SODA ni writes);
- corrida real contra Postgres + Storage (secrets).

El CLI ``run-catalunya`` y el workflow Actions delegan aquí.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from pathlib import Path

from efilicit_ingestion.connectors.socrata import CATALUNYA, SocrataConnector, SocrataDataset
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
    "CatalunyaRunConfig",
    "run_catalunya",
    "format_result",
    "load_fixture_bytes",
]


@dataclass(frozen=True)
class CatalunyaRunConfig:
    """Opciones de una corrida local / documentada del pipeline Catalunya.

    ``page_size`` / ``max_pages`` / ``start_offset`` acotan el discover SODA
    (en live empezar con 1 página). ``dry_run`` evita Postgres y Storage.
    """

    fixture_path: Path | None = None
    page_size: int = 1000
    max_pages: int = 1
    start_offset: int = 0
    dry_run: bool = False
    run_id: str | None = None
    use_storage: bool = True
    dataset: SocrataDataset = CATALUNYA


def load_fixture_bytes(path: Path) -> bytes:
    """Carga una página fixture JSON (array SODA, como la API real)."""
    raw = path.read_bytes()
    if path.suffix.lower() != ".json":
        raise ValueError(f"unsupported fixture type (expected .json): {path}")
    if not raw.strip().startswith(b"["):
        raise ValueError(f"fixture must be a JSON array: {path}")
    return raw


def run_catalunya(config: CatalunyaRunConfig) -> PipelineResult:
    """Ejecuta discover→…→upsert para páginas SODA de Catalunya.

    - ``fixture_path``: inventa un ``fetch_transport`` que siempre devuelve
      ese JSON (E2E offline; el discover sigue generando keys/URLs).
    - sin fixture: discover/fetch live de ``max_pages`` desde ``start_offset``.
    - ``dry_run``: sync/canónico/storage en memoria (sin writes).
    """
    dataset = config.dataset
    run_id = config.run_id or f"{dataset.source_code}-{uuid.uuid4()}"

    fetch_transport = None
    if config.fixture_path is not None:
        fixture_bytes = load_fixture_bytes(config.fixture_path)
        # Misma firma que FetchTransport: ignore URL, devuelve la página fixture.
        fetch_transport = lambda url, data=fixture_bytes: (
            200,
            {"content-type": "application/json", "content-length": str(len(data))},
            data,
        )

    connector = SocrataConnector(
        dataset=dataset,
        page_size=config.page_size,
        max_pages=config.max_pages,
        start_offset=config.start_offset,
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
