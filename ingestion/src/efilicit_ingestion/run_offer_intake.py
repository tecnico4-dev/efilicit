"""Worker del intake de pliegos del expediente (ADR 035).

Toma trabajos ``pending`` de ``offer_case_intake``, lee el RAW PLACSP de la
licitación, vuelca pliegos/requisitos/sobres/hitos y descarga los pliegos
del servlet oficial a ``offer-docs``. Un trabajo = una transacción.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

import httpx
import psycopg

from efilicit_ingestion.offer_intake import postgres as repo
from efilicit_ingestion.offer_intake.fetch import (
    DEFAULT_MAX_BYTES,
    DocumentFetchError,
    fetch_document,
)
from efilicit_ingestion.offer_intake.placsp_terms import parse_offer_terms
from efilicit_ingestion.offer_intake.plan import build_intake_plan, target_lot_ids
from efilicit_ingestion.offer_intake.storage import IntakeStorage
from efilicit_ingestion.pipeline.postgres import connect


@dataclass(frozen=True, slots=True)
class OfferIntakeRunConfig:
    limit: int = 10
    offer_case_id: str | None = None
    download: bool = True
    max_bytes: int = DEFAULT_MAX_BYTES
    download_pause_seconds: float = 0.5


@dataclass
class JobOutcome:
    offer_case_id: UUID
    status: str
    stats: dict[str, Any] = field(default_factory=dict)
    error: str | None = None


@dataclass
class OfferIntakeRunResult:
    jobs: list[JobOutcome] = field(default_factory=list)

    @property
    def failed(self) -> int:
        return sum(1 for job in self.jobs if job.status == "failed")


def run_offer_intake(
    config: OfferIntakeRunConfig | None = None,
    *,
    connect_fn: Callable[[], psycopg.Connection] = connect,
    storage: IntakeStorage | None = None,
    http_client: httpx.Client | None = None,
) -> OfferIntakeRunResult:
    cfg = config or OfferIntakeRunConfig()
    result = OfferIntakeRunResult()
    own_storage = storage is None
    own_http = http_client is None
    storage = storage or IntakeStorage()
    http_client = http_client or httpx.Client(
        timeout=httpx.Timeout(90.0, connect=20.0), follow_redirects=True
    )
    try:
        with connect_fn() as conn:
            if cfg.offer_case_id:
                repo.enqueue(conn, cfg.offer_case_id)
            jobs = repo.claim_jobs(conn, limit=cfg.limit, offer_case_id=cfg.offer_case_id)
            conn.commit()
            for job in jobs:
                result.jobs.append(_process_job(conn, job, cfg, storage, http_client))
    finally:
        if own_storage:
            storage.close()
        if own_http:
            http_client.close()
    return result


def _process_job(
    conn: psycopg.Connection,
    job: repo.IntakeJob,
    cfg: OfferIntakeRunConfig,
    storage: IntakeStorage,
    http_client: httpx.Client,
) -> JobOutcome:
    try:
        stats = _process_case(conn, job.offer_case_id, cfg, storage, http_client)
        repo.finish_job(conn, job.id, status="done", stats=stats)
        conn.commit()
        return JobOutcome(job.offer_case_id, "done", stats)
    except Exception as exc:  # noqa: BLE001 — el trabajo queda failed con el motivo
        conn.rollback()
        error = f"{type(exc).__name__}: {exc}"
        repo.finish_job(conn, job.id, status="failed", error=error)
        conn.commit()
        return JobOutcome(job.offer_case_id, "failed", error=error)


def _process_case(
    conn: psycopg.Connection,
    offer_case_id: UUID,
    cfg: OfferIntakeRunConfig,
    storage: IntakeStorage,
    http_client: httpx.Client,
) -> dict[str, Any]:
    source = repo.load_case_source(conn, offer_case_id)
    if source is None:
        raise LookupError("expediente no encontrado")
    if source.storage_path is None:
        return {"skipped": "sin RAW PLACSP para esta licitación"}

    extract = parse_offer_terms(storage.download(source.storage_path))
    plan = build_intake_plan(extract, target_lots=target_lot_ids(source.target_lots))
    applied = repo.apply_plan(conn, offer_case_id, plan)

    downloaded = 0
    failed = 0
    if cfg.download:
        for item in repo.pending_downloads(conn, offer_case_id):
            if downloaded or failed:
                time.sleep(cfg.download_pause_seconds)
            try:
                doc = fetch_document(http_client, item.url, max_bytes=cfg.max_bytes)
            except DocumentFetchError as exc:
                repo.mark_fetch_error(conn, item.pliego_id, str(exc))
                failed += 1
                continue
            storage_path = storage.upload(
                object_key=f"{offer_case_id}/{doc.checksum}.{doc.extension}",
                raw=doc.raw,
                content_type=doc.content_type,
            )
            repo.mark_downloaded(
                conn,
                item.pliego_id,
                storage_path=storage_path,
                checksum=doc.checksum,
                byte_size=doc.byte_size,
                content_type=doc.content_type,
            )
            downloaded += 1

    stats = {
        "source_code": source.source_code,
        "pliegos_new": applied.pliegos,
        "requirements_new": applied.requirements,
        "deliverables_new": applied.deliverables,
        "milestones_new": applied.milestones,
        "documents_downloaded": downloaded,
        "documents_failed": failed,
    }
    if applied.total or downloaded:
        repo.log_intake(conn, offer_case_id, _log_body(stats))
    return stats


def _log_body(stats: dict[str, Any]) -> str:
    parts = [
        f"{stats['pliegos_new']} pliegos",
        f"{stats['requirements_new']} requisitos",
        f"{stats['deliverables_new']} sobres/entregables",
        f"{stats['milestones_new']} hitos",
    ]
    text = "Intake PLACSP: " + ", ".join(parts) + "."
    if stats["documents_downloaded"] or stats["documents_failed"]:
        text += (
            f" Descargados {stats['documents_downloaded']} documentos"
            f" ({stats['documents_failed']} con error)."
        )
    return text


def format_result(result: OfferIntakeRunResult) -> str:
    if not result.jobs:
        return "offer-intake: sin trabajos pendientes"
    lines = [f"offer-intake: {len(result.jobs)} trabajos ({result.failed} fallidos)"]
    for job in result.jobs:
        detail = job.error if job.error else ", ".join(f"{k}={v}" for k, v in job.stats.items())
        lines.append(f"  {job.offer_case_id} {job.status}: {detail}")
    return "\n".join(lines)
