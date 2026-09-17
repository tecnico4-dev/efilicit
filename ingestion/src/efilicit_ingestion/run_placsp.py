"""Run PLACSP ingestion end-to-end (Semana 2 Paso 8; Semana 3 agregadas)."""

from __future__ import annotations

import uuid
import zipfile
from dataclasses import dataclass
from datetime import date
from io import BytesIO
from pathlib import Path

from efilicit_ingestion.connectors.placsp import PlacspConnector
from efilicit_ingestion.connectors.placsp.urls import PLACSP, PlacspSyndication
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


@dataclass(frozen=True)
class PlacspRunConfig:
    """Options for a local / documented PLACSP pipeline run."""

    fixture_path: Path | None = None
    from_year_month: str | None = None
    to_year_month: str | None = None
    as_of: date | None = None
    dry_run: bool = False
    run_id: str | None = None
    use_storage: bool = True
    syndication: PlacspSyndication = PLACSP


def load_fixture_bytes(
    path: Path,
    *,
    syndication: PlacspSyndication = PLACSP,
) -> bytes:
    """Load a ``.atom`` or ``.zip`` fixture; wrap bare Atom into a ZIP package."""
    raw = path.read_bytes()
    if path.suffix.lower() == ".zip" or raw.startswith(b"PK"):
        return raw
    if path.suffix.lower() in {".atom", ".xml"}:
        member = f"{syndication.feed_base_name}.atom"
        buf = BytesIO()
        with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            zf.writestr(member, raw)
        return buf.getvalue()
    raise ValueError(f"unsupported fixture type: {path}")


def run_placsp(config: PlacspRunConfig) -> PipelineResult:
    """Execute discover→…→upsert for a PLACSP syndication.

    - ``fixture_path``: offline E2E (no live PLACSP network).
    - without fixture: live discover/fetch for the configured month window.
    - ``dry_run``: in-memory sync/canonical/storage (no Postgres/Storage writes).
    - ``syndication``: default ``PLACSP`` (perfiles); also ``PLACSP_AGREGADAS``,
      ``PLACSP_MENORES``.
    """
    as_of = config.as_of or date.today()
    feed = config.syndication
    run_id = config.run_id or f"{feed.source_code}-{uuid.uuid4()}"

    fetch_transport = None
    if config.fixture_path is not None:
        fixture_bytes = load_fixture_bytes(config.fixture_path, syndication=feed)
        fetch_transport = lambda url, data=fixture_bytes: (
            200,
            {"content-type": "application/zip", "content-length": str(len(data))},
            data,
        )
        # Force a single known month window for fixture runs.
        from_ym = config.from_year_month or f"{as_of.year:04d}-{as_of.month:02d}"
        to_ym = config.to_year_month or from_ym
    else:
        from_ym = config.from_year_month
        to_ym = config.to_year_month

    connector = PlacspConnector(
        syndication=feed,
        from_year_month=from_ym,
        to_year_month=to_ym,
        as_of=as_of,
        fetch_transport=fetch_transport,
    )
    context = SyncContext(source_code=connector.source_code, run_id=run_id)

    if config.dry_run:
        artifact_store = InMemoryArtifactStore()
        sync_repo = InMemorySyncRepository()
        canonical_repo = InMemoryCanonicalRepository()
        result = run_pipeline(
            connector,
            context,
            artifact_store=artifact_store,
            sync_repo=sync_repo,
            canonical_repo=canonical_repo,
        )
        return result

    artifact_store: object
    if config.use_storage:
        key = default_service_role_key()
        if not key:
            raise RuntimeError(
                "SUPABASE_SERVICE_ROLE_KEY is required for Storage uploads "
                "(or pass dry_run=True / use_storage=False)."
            )
        artifact_store = SupabaseStorageArtifactStore(
            base_url=default_supabase_url(),
            service_role_key=key,
        )
    else:
        artifact_store = InMemoryArtifactStore()

    with connect() as conn:
        sync_repo = PostgresSyncRepository(conn)
        canonical_repo = PostgresCanonicalRepository(conn)
        result = run_pipeline(
            connector,
            context,
            artifact_store=artifact_store,  # type: ignore[arg-type]
            sync_repo=sync_repo,
            canonical_repo=canonical_repo,
        )
        conn.commit()
    return result


def format_result(result: PipelineResult) -> str:
    sync = result.sync
    lines = [
        f"status={sync.status}",
        f"run_id={sync.run_id}",
        f"source_code={sync.source_code}",
        f"records_seen={sync.records_seen}",
        f"records_new={sync.records_new}",
        f"records_updated={sync.records_updated}",
        f"artifacts={len(result.stored_artifacts)}",
    ]
    if result.stored_artifacts:
        art = result.stored_artifacts[0]
        lines.append(f"raw_path={art.storage_path}")
        lines.append(f"checksum={art.checksum}")
    if sync.error_message:
        lines.append(f"error={sync.error_message}")
    return "\n".join(lines)
