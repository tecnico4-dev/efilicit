"""Pipeline PLACSP con RAW incremental por entry (ADR 022) y commit por página (ADR 033).

Descarga el ZIP mensual; no lo sube. Materializa solo ``atom:entry`` nuevas
(content-addressed). Entries ya conocidas por checksum se saltan.
Tras cada fichero ``.atom`` del ZIP se invoca ``on_page_committed`` (p. ej.
``conn.commit``) para no perder todo el mes si falla a mitad.
"""

from __future__ import annotations

import sys
from collections.abc import Callable

from efilicit_ingestion.connectors.placsp.errors import placsp_source_unavailable_reason
from efilicit_ingestion.connectors.placsp.expand_entries import (
    ExpandedPlacspEntry,
    expand_placsp_pages,
)
from efilicit_ingestion.connectors.placsp.parser import (
    keep_newest_by_source_record_id,
    parse_placsp_artifact,
)
from efilicit_ingestion.connectors.protocol import SourceConnector
from efilicit_ingestion.models import RemoteArtifact, SourceRecord, SyncContext
from efilicit_ingestion.pipeline import stages
from efilicit_ingestion.pipeline.canonical_repo import CanonicalRepository
from efilicit_ingestion.pipeline.ports import ArtifactStore, SyncRepository
from efilicit_ingestion.pipeline.runner import (
    PipelineRunError,
    SourceUnavailableError,
    mark_run_failed,
)
from efilicit_ingestion.pipeline.types import PipelineResult, StoredArtifact


def _process_page_entries(
    *,
    connector: SourceConnector,
    package: RemoteArtifact,
    entries: list[ExpandedPlacspEntry],
    artifact_store: ArtifactStore,
    sync_repo: SyncRepository,
    run,
    canonical_repo: CanonicalRepository | None,
    stored_artifacts: list[StoredArtifact],
) -> tuple[int, int]:
    """Store/parse/upsert de una página Atom. Devuelve (processed, skipped)."""
    pending: list[tuple[SourceRecord, str | None]] = []
    entries_skipped = 0
    records_processed = 0

    for entry in entries:
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

    if not pending:
        return records_processed, entries_skipped

    newest = keep_newest_by_source_record_id([r for r, _ in pending])
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

    return records_processed, entries_skipped


def run_pipeline_placsp_incremental(
    connector: SourceConnector,
    context: SyncContext,
    *,
    artifact_store: ArtifactStore,
    sync_repo: SyncRepository,
    canonical_repo: CanonicalRepository | None = None,
    on_page_committed: Callable[[], None] | None = None,
) -> PipelineResult:
    """Una sync PLACSP: ZIP → páginas Atom → store/parse solo novedades.

    ``on_page_committed`` se llama tras cada ``.atom`` del ZIP (y tras un Atom
    suelto tratado como una página). En Postgres suele ser ``conn.commit``.
    """
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
            pages = expand_placsp_pages(zip_raw, package)

            for page in pages:
                processed, skipped = _process_page_entries(
                    connector=connector,
                    package=package,
                    entries=page.entries,
                    artifact_store=artifact_store,
                    sync_repo=sync_repo,
                    run=run,
                    canonical_repo=canonical_repo,
                    stored_artifacts=stored_artifacts,
                )
                records_processed += processed
                entries_skipped += skipped
                if on_page_committed is not None:
                    on_page_committed()

            run.cursor = stages.checkpoint(run.cursor, package.artifact_key)
            run.last_artifact = package.artifact_key

        if entries_skipped and run.checksum is None:
            run.checksum = f"skipped_entries={entries_skipped}"

        sync_repo.finish_run(run, status="success")
    except PipelineRunError:
        raise
    except SourceUnavailableError:
        raise
    except Exception as exc:  # noqa: BLE001
        unavailable = placsp_source_unavailable_reason(exc)
        if unavailable is not None:
            print(f"pipeline source unavailable: {unavailable}", file=sys.stderr)
            sync_repo.finish_run(run, status="success", error_message=unavailable)
            raise SourceUnavailableError(run, exc, reason=unavailable) from exc
        mark_run_failed(sync_repo, run, exc)
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
    """Igual que ``run_pipeline_postgres`` pero con expand entry-level + commit por página."""
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
                on_page_committed=conn.commit,
            )
            conn.commit()
            return result
        except SourceUnavailableError:
            # source_sync ya quedó success + error_message; no marcar failed.
            conn.commit()
            raise
        except PipelineRunError as exc:
            conn.rollback()
            persist_failed_sync_run(exc.sync)
            raise exc.cause from exc
