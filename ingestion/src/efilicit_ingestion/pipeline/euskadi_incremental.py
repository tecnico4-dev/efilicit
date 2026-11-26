"""Pipeline Euskadi con RAW incremental por aviso (ADR 025).

Descarga páginas de la cabeza del listado; no las sube. Materializa solo
avisos nuevos (content-addressed). Ítems ya conocidos por checksum se saltan.
"""

from __future__ import annotations

import json

from efilicit_ingestion.connectors.euskadi.expand_items import expand_euskadi_items
from efilicit_ingestion.connectors.euskadi.parser import parse_euskadi_artifact
from efilicit_ingestion.connectors.protocol import SourceConnector
from efilicit_ingestion.models import RemoteArtifact, SyncContext
from efilicit_ingestion.pipeline import stages
from efilicit_ingestion.pipeline.canonical_repo import CanonicalRepository
from efilicit_ingestion.pipeline.ports import ArtifactStore, SyncRepository
from efilicit_ingestion.pipeline.runner import PipelineRunError, mark_run_failed
from efilicit_ingestion.pipeline.types import PipelineResult, StoredArtifact


def run_pipeline_euskadi_incremental(
    connector: SourceConnector,
    context: SyncContext,
    *,
    artifact_store: ArtifactStore,
    sync_repo: SyncRepository,
    canonical_repo: CanonicalRepository | None = None,
) -> PipelineResult:
    """Una sync Euskadi: páginas → expand ítems → store/parse solo novedades."""
    run = sync_repo.start_run(
        source_code=connector.source_code,
        run_id=context.run_id,
        cursor=context.cursor,
    )
    stored_artifacts: list[StoredArtifact] = []
    records_processed = 0
    items_skipped = 0

    try:
        pages = connector.discover(context)
        for page in pages:
            page_raw = connector.fetch(page)
            page_raw = stages.validate_artifact(page_raw, page)
            expanded = expand_euskadi_items(page_raw, page)

            for item in expanded:
                known = sync_repo.find_artifact_by_checksum(
                    connector.source_code,
                    item.checksum,
                )
                if known is not None:
                    items_skipped += 1
                    continue

                item_artifact = RemoteArtifact(
                    artifact_key=item.artifact_key,
                    source_url=item.source_url or page.source_url,
                    content_type="application/json",
                    metadata={
                        **(page.metadata or {}),
                        "page_artifact_key": page.artifact_key,
                        "source_record_id": item.source_record_id,
                        "raw_kind": "euskadi_item",
                    },
                )
                stored = stages.store_raw(
                    source_code=connector.source_code,
                    artifact=item_artifact,
                    raw=item.raw,
                    store=artifact_store,
                )
                artifact_id = sync_repo.register_artifact(run, stored)
                stored_artifacts.append(stored)

                # El parser espera ``{items:[...]}``; envolviendo el aviso canónico.
                wrapped = json.dumps(
                    {"items": [json.loads(item.raw.decode("utf-8"))]},
                    ensure_ascii=False,
                    separators=(",", ":"),
                ).encode("utf-8")
                records = list(parse_euskadi_artifact(wrapped, item_artifact))
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

        if items_skipped and run.checksum is None:
            run.checksum = f"skipped_items={items_skipped}"

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


def run_pipeline_euskadi_incremental_postgres(
    connector: SourceConnector,
    context: SyncContext,
    *,
    artifact_store: ArtifactStore,
) -> PipelineResult:
    """Igual que ``run_pipeline_postgres`` pero con expand item-level (ADR 025)."""
    from efilicit_ingestion.pipeline.canonical_repo import PostgresCanonicalRepository
    from efilicit_ingestion.pipeline.postgres import (
        PostgresSyncRepository,
        connect,
        persist_failed_sync_run,
    )

    with connect() as conn:
        try:
            result = run_pipeline_euskadi_incremental(
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
