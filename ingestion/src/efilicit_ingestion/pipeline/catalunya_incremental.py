"""Pipeline Catalunya con RAW incremental por fila SODA (ADR 025).

Descarga páginas filtradas por ventana SoQL; no las sube. Materializa solo
filas nuevas (content-addressed). Filas ya conocidas por checksum se saltan.
"""

from __future__ import annotations

from efilicit_ingestion.connectors.protocol import SourceConnector
from efilicit_ingestion.connectors.socrata.expand_rows import expand_socrata_rows
from efilicit_ingestion.connectors.socrata.parser import parse_socrata_artifact
from efilicit_ingestion.models import RemoteArtifact, SyncContext
from efilicit_ingestion.pipeline import stages
from efilicit_ingestion.pipeline.canonical_repo import CanonicalRepository
from efilicit_ingestion.pipeline.ports import ArtifactStore, SyncRepository
from efilicit_ingestion.pipeline.runner import PipelineRunError, mark_run_failed
from efilicit_ingestion.pipeline.types import PipelineResult, StoredArtifact


def run_pipeline_catalunya_incremental(
    connector: SourceConnector,
    context: SyncContext,
    *,
    artifact_store: ArtifactStore,
    sync_repo: SyncRepository,
    canonical_repo: CanonicalRepository | None = None,
) -> PipelineResult:
    """Una sync Catalunya: páginas → expand filas → store/parse solo novedades."""
    run = sync_repo.start_run(
        source_code=connector.source_code,
        run_id=context.run_id,
        cursor=context.cursor,
    )
    stored_artifacts: list[StoredArtifact] = []
    records_processed = 0
    rows_skipped = 0

    try:
        pages = connector.discover(context)
        for page in pages:
            page_raw = connector.fetch(page)
            page_raw = stages.validate_artifact(page_raw, page)
            expanded = expand_socrata_rows(page_raw, page)

            for row in expanded:
                known = sync_repo.find_artifact_by_checksum(
                    connector.source_code,
                    row.checksum,
                )
                if known is not None:
                    rows_skipped += 1
                    continue

                row_artifact = RemoteArtifact(
                    artifact_key=row.artifact_key,
                    source_url=row.source_url or page.source_url,
                    content_type="application/json",
                    metadata={
                        **(page.metadata or {}),
                        "page_artifact_key": page.artifact_key,
                        "source_record_id": row.source_record_id,
                        "raw_kind": "socrata_row",
                    },
                )
                stored = stages.store_raw(
                    source_code=connector.source_code,
                    artifact=row_artifact,
                    raw=row.raw,
                    store=artifact_store,
                )
                artifact_id = sync_repo.register_artifact(run, stored)
                stored_artifacts.append(stored)

                # El parser espera un array SODA; envolviendo la fila canónica.
                records = list(
                    parse_socrata_artifact(
                        b"[" + row.raw + b"]",
                        row_artifact,
                    )
                )
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

            run.cursor = stages.checkpoint(run.cursor, page.artifact_key)
            run.last_artifact = page.artifact_key

        if rows_skipped and run.checksum is None:
            run.checksum = f"skipped_rows={rows_skipped}"

        sync_repo.finish_run(run, status="success")
    except PipelineRunError:
        raise
    except Exception as exc:  # noqa: BLE001
        mark_run_failed(sync_repo, run, exc)
        raise PipelineRunError(run, exc) from exc

    return PipelineResult(
        sync=run,
        records_processed=records_processed,
        stored_artifacts=stored_artifacts,
    )


def run_pipeline_catalunya_incremental_postgres(
    connector: SourceConnector,
    context: SyncContext,
    *,
    artifact_store: ArtifactStore,
) -> PipelineResult:
    """Igual que ``run_pipeline_postgres`` pero con expand row-level (ADR 025)."""
    from efilicit_ingestion.pipeline.canonical_repo import PostgresCanonicalRepository
    from efilicit_ingestion.pipeline.postgres import (
        PostgresSyncRepository,
        connect,
        persist_failed_sync_run,
    )

    with connect() as conn:
        try:
            result = run_pipeline_catalunya_incremental(
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
