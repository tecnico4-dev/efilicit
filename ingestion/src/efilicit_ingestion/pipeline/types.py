"""Shared types for the common ingestion pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True)
class StoredArtifact:
    """Result of store_raw: path + checksum (RAW evidence metadata)."""

    artifact_key: str
    checksum: str
    storage_path: str
    byte_size: int
    content_type: str | None = None
    source_url: str | None = None


@dataclass
class SyncRun:
    """In-memory / DB-agnostic view of a source_sync row."""

    source_code: str
    run_id: str
    id: str | None = None
    status: str = "running"
    cursor: str | None = None
    last_artifact: str | None = None
    checksum: str | None = None
    records_seen: int = 0
    records_new: int = 0
    records_updated: int = 0
    records_failed: int = 0
    error_message: str | None = None
    started_at: datetime = field(default_factory=utc_now)
    finished_at: datetime | None = None
    artifacts: list[StoredArtifact] = field(default_factory=list)


@dataclass
class PipelineResult:
    """Outcome of one pipeline run for tests and callers."""

    sync: SyncRun
    records_processed: int
    stored_artifacts: list[StoredArtifact]
