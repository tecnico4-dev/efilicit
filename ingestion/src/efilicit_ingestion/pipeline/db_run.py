"""Ejecutar el pipeline contra Postgres con commit/bitácora de fallo fiable.

Si el upsert falla a mitad, el ``with connect()`` haría rollback de *toda*
la transacción — incluido el ``source_sync`` marcado ``failed``. Aquí:

1. éxito → ``commit`` de canónico + sync;
2. fallo → ``rollback`` del trabajo a medias + **nueva** conexión que
   persiste la fila ``source_sync`` en ``failed`` (contadores / mensaje).
"""

from __future__ import annotations

from efilicit_ingestion.connectors.protocol import SourceConnector
from efilicit_ingestion.models import SyncContext
from efilicit_ingestion.pipeline.canonical_repo import PostgresCanonicalRepository
from efilicit_ingestion.pipeline.ports import ArtifactStore
from efilicit_ingestion.pipeline.postgres import (
    PostgresSyncRepository,
    connect,
    persist_failed_sync_run,
)
from efilicit_ingestion.pipeline.runner import PipelineRunError, run_pipeline
from efilicit_ingestion.pipeline.types import PipelineResult


def run_pipeline_postgres(
    connector: SourceConnector,
    context: SyncContext,
    *,
    artifact_store: ArtifactStore,
) -> PipelineResult:
    """``run_pipeline`` + commit; ante fallo, persiste ``source_sync`` failed."""
    with connect() as conn:
        try:
            result = run_pipeline(
                connector,
                context,
                artifact_store=artifact_store,
                sync_repo=PostgresSyncRepository(conn),
                canonical_repo=PostgresCanonicalRepository(conn),
            )
            conn.commit()
            return result
        except PipelineRunError as exc:
            conn.rollback()
            persist_failed_sync_run(exc.sync)
            raise exc.cause from exc
