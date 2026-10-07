"""Orquesta conector + etapas comunes del pipeline (desde Semana 1).

Nació con el stub + bitácora Postgres; Semana 2+ cableó fuentes reales sin
cambiar este orquestador. Solo conoce ``SourceConnector`` y las etapas.

Orden: discover → fetch → validate → store_raw → parse → normalize →
identidad → matching → upsert → checkpoint. El RAW se guarda **antes** del
parse para no perder evidencia si el parser falla.
"""

from __future__ import annotations

from efilicit_ingestion.connectors.protocol import SourceConnector
from efilicit_ingestion.models import SyncContext
from efilicit_ingestion.pipeline import stages
from efilicit_ingestion.pipeline.canonical_repo import CanonicalRepository
from efilicit_ingestion.pipeline.ports import ArtifactStore, SyncRepository
from efilicit_ingestion.pipeline.types import PipelineResult, SyncRun


class PipelineRunError(Exception):
    """Fallo del pipeline con el ``SyncRun`` ya cerrado en memoria (failed).

    El caller Postgres debe hacer rollback del trabajo canónico y persistir
    ``sync`` en una transacción aparte (ver ``db_run.run_pipeline_postgres``).
    """

    def __init__(self, sync: SyncRun, cause: BaseException) -> None:
        self.sync = sync
        self.cause = cause
        super().__init__(str(cause))


def run_pipeline(
    connector: SourceConnector,
    context: SyncContext,
    *,
    artifact_store: ArtifactStore,
    sync_repo: SyncRepository,
    canonical_repo: CanonicalRepository | None = None,
) -> PipelineResult:
    """Una sync completa por cada artefacto descubierto.

    Ante excepción: cierra el run como ``failed`` en ``source_sync``
    (``error_message``) y relanza. No escribe en ``public.errors`` (ADR 003).
    Sin ``canonical_repo``, el upsert Semana 1 solo cuenta registros como
    ``new`` (útil para stub / tests de bitácora).
    """
    run = sync_repo.start_run(
        source_code=connector.source_code,
        run_id=context.run_id,
        cursor=context.cursor,
    )
    stored_artifacts = []
    records_processed = 0

    try:
        artifacts = connector.discover(context)
        for artifact in artifacts:
            raw = connector.fetch(artifact)
            raw = stages.validate_artifact(raw, artifact)
            stored = stages.store_raw(
                source_code=connector.source_code,
                artifact=artifact,
                raw=raw,
                store=artifact_store,
            )
            artifact_id = sync_repo.register_artifact(run, stored)
            stored_artifacts.append(stored)

            records = list(connector.parse(raw, artifact))
            records = stages.normalize(records)
            records = stages.enrich(records)
            records = stages.resolve_identity(records)
            records = stages.deduplicate(
                records,
                source_code=connector.source_code,
                canonical_repo=canonical_repo,
            )
            records = stages.quality_checks(records)
            seen, new, updated = stages.upsert(
                records,
                source_code=connector.source_code,
                canonical_repo=canonical_repo,
                artifact_id=artifact_id,
            )
            stages.emit_events(records)

            run.records_seen += seen
            run.records_new += new
            run.records_updated += updated
            records_processed += seen

            run.cursor = stages.checkpoint(run.cursor, stored.artifact_key)

        sync_repo.finish_run(run, status="success")
    except PipelineRunError:
        raise
    except Exception as exc:  # noqa: BLE001 — clasificación más rica en semanas posteriores
        run.records_failed += 1
        sync_repo.finish_run(run, status="failed", error_message=str(exc))
        raise PipelineRunError(run, exc) from exc

    return PipelineResult(
        sync=run,
        records_processed=records_processed,
        stored_artifacts=stored_artifacts,
    )
