"""Orchestrates connector + common pipeline stages for one sync run."""

from __future__ import annotations

from efilicit_ingestion.connectors.protocol import SourceConnector
from efilicit_ingestion.models import SyncContext
from efilicit_ingestion.pipeline import stages
from efilicit_ingestion.pipeline.canonical_repo import CanonicalRepository
from efilicit_ingestion.pipeline.ports import ArtifactStore, SyncRepository
from efilicit_ingestion.pipeline.types import PipelineResult


def run_pipeline(
    connector: SourceConnector,
    context: SyncContext,
    *,
    artifact_store: ArtifactStore,
    sync_repo: SyncRepository,
    canonical_repo: CanonicalRepository | None = None,
) -> PipelineResult:
    """discover → fetch → validate → store_raw → parse → normalize → upsert → checkpoint."""
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
            records = stages.deduplicate(records)
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
    except Exception as exc:  # noqa: BLE001 — classify richer in later weeks
        run.records_failed += 1
        sync_repo.finish_run(run, status="failed", error_message=str(exc))
        raise

    return PipelineResult(
        sync=run,
        records_processed=records_processed,
        stored_artifacts=stored_artifacts,
    )
