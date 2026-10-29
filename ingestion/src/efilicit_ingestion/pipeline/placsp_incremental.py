"""Pipeline PLACSP con RAW incremental por entry (ADR 022).

Descarga el ZIP mensual; no lo sube. Materializa solo ``atom:entry`` nuevas
(content-addressed). Entries ya conocidas por checksum se saltan.
"""

from __future__ import annotations

from efilicit_ingestion.connectors.placsp.expand_entries import expand_placsp_entries
from efilicit_ingestion.connectors.placsp.parser import (
    keep_newest_by_source_record_id,
    parse_placsp_artifact,
)
from efilicit_ingestion.connectors.protocol import SourceConnector
from efilicit_ingestion.models import RemoteArtifact, SourceRecord, SyncContext
from efilicit_ingestion.pipeline import stages
from efilicit_ingestion.pipeline.canonical_repo import CanonicalRepository
from efilicit_ingestion.pipeline.ports import ArtifactStore, SyncRepository
from efilicit_ingestion.pipeline.runner import PipelineRunError
from efilicit_ingestion.pipeline.types import PipelineResult, StoredArtifact


def run_pipeline_placsp_incremental(
    connector: SourceConnector,
    context: SyncContext,
    *,
    artifact_store: ArtifactStore,
    sync_repo: SyncRepository,
    canonical_repo: CanonicalRepository | None = None,
) -> PipelineResult:
    """Una sync PLACSP: ZIP → expand entries → store/parse solo novedades."""
    run = sync_repo.start_run(
        source_code=connector.source_code,
        run_id=context.run_id,
        cursor=context.cursor,
    )
    stored_artifacts: list[StoredArtifact] = []
    records_processed = 0
    entries_skipped = 0

    try:
        packages = connector.discover(context)
        for package in packages:
            zip_raw = connector.fetch(package)
            zip_raw = stages.validate_artifact(zip_raw, package)
            expanded = expand_placsp_entries(zip_raw, package)

            pending: list[tuple[SourceRecord, str | None]] = []

            for entry in expanded:
                known = sync_repo.find_artifact_by_checksum(
                    connector.source_code,
                    entry.checksum,
                )
                if known is not None:
                    entries_skipped += 1
                    continue

                entry_artifact = RemoteArtifact(
                    artifact_key=entry.artifact_key,
                    source_url=entry.source_url or package.source_url,
                    content_type="application/atom+xml",
                    metadata={
                        **(package.metadata or {}),
                        "package_artifact_key": package.artifact_key,
                        "atom_member": entry.member_name,
                        "raw_kind": "placsp_entry",
                    },
                )
                stored = stages.store_raw(
                    source_code=connector.source_code,
                    artifact=entry_artifact,
                    raw=entry.raw,
                    store=artifact_store,
                )
                artifact_id = sync_repo.register_artifact(run, stored)
                stored_artifacts.append(stored)

                for record in parse_placsp_artifact(entry.raw, entry_artifact):
                    pending.append((record, artifact_id))

            if pending:
                newest = keep_newest_by_source_record_id([r for r, _ in pending])
                # artifact_id de la entry cuyo record ganó (mismo objeto o misma identidad+fecha)
                artifact_by_id: dict[str, str | None] = {}
                for record, artifact_id in pending:
                    for winner in newest:
                        if winner is record:
                            artifact_by_id[winner.source_record_id] = artifact_id
                            break
                        if (
                            winner.source_record_id == record.source_record_id
                            and winner.recorded_at == record.recorded_at
                            and winner.source_record_id not in artifact_by_id
                        ):
                            artifact_by_id[winner.source_record_id] = artifact_id

                by_artifact: dict[str | None, list[SourceRecord]] = {}
                for winner in newest:
                    aid = artifact_by_id.get(winner.source_record_id)
                    by_artifact.setdefault(aid, []).append(winner)

                for artifact_id, group in by_artifact.items():
                    records = stages.normalize(group)
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

            run.cursor = stages.checkpoint(run.cursor, package.artifact_key)
            run.last_artifact = package.artifact_key

        if entries_skipped and run.checksum is None:
            run.checksum = f"skipped_entries={entries_skipped}"

        sync_repo.finish_run(run, status="success")
    except PipelineRunError:
        raise
    except Exception as exc:  # noqa: BLE001
        run.records_failed += 1
        sync_repo.finish_run(run, status="failed", error_message=str(exc))
        raise PipelineRunError(run, exc) from exc

    return PipelineResult(
        sync=run,
        records_processed=records_processed,
        stored_artifacts=stored_artifacts,
    )


def run_pipeline_placsp_incremental_postgres(
    connector: SourceConnector,
    context: SyncContext,
    *,
    artifact_store: ArtifactStore,
) -> PipelineResult:
    """Igual que ``run_pipeline_postgres`` pero con expand entry-level."""
    from efilicit_ingestion.pipeline.canonical_repo import PostgresCanonicalRepository
    from efilicit_ingestion.pipeline.postgres import (
        PostgresSyncRepository,
        connect,
        persist_failed_sync_run,
    )

    with connect() as conn:
        try:
            result = run_pipeline_placsp_incremental(
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
