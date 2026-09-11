"""Common pipeline stages (docs/01 §5). Semana 1: real validate/store_raw; others pass-through."""

from __future__ import annotations

from efilicit_ingestion.models import RemoteArtifact, SourceRecord
from efilicit_ingestion.pipeline.ports import ArtifactStore
from efilicit_ingestion.pipeline.types import StoredArtifact


def validate_artifact(raw: bytes, artifact: RemoteArtifact) -> bytes:
    """Reject empty / clearly invalid payloads before RAW storage / parse."""
    if not raw:
        raise ValueError(f"empty artifact payload: {artifact.artifact_key}")

    content_type = (artifact.content_type or "").lower()
    key = artifact.artifact_key.lower()
    looks_like_zip = "zip" in content_type or key.endswith(".zip")
    if looks_like_zip and not raw.startswith(b"PK"):
        raise ValueError(
            f"artifact does not look like a ZIP (missing PK header): "
            f"{artifact.artifact_key}"
        )
    return raw


def store_raw(
    *,
    source_code: str,
    artifact: RemoteArtifact,
    raw: bytes,
    store: ArtifactStore,
) -> StoredArtifact:
    """Store RAW and return checksum + storage_path metadata."""
    return store.store(source_code=source_code, artifact=artifact, raw=raw)


def normalize(records: list[SourceRecord]) -> list[SourceRecord]:
    """Placeholder: domain normalization arrives with real sources (Semana 2)."""
    return records


def enrich(records: list[SourceRecord]) -> list[SourceRecord]:
    """Placeholder: enrichment later."""
    return records


def resolve_identity(records: list[SourceRecord]) -> list[SourceRecord]:
    """Placeholder: entity resolution later."""
    return records


def deduplicate(records: list[SourceRecord]) -> list[SourceRecord]:
    """Placeholder: cross-source dedup later (Semana 4)."""
    return records


def quality_checks(records: list[SourceRecord]) -> list[SourceRecord]:
    """Placeholder: quality rules later."""
    return records


def upsert(records: list[SourceRecord]) -> tuple[int, int]:
    """Placeholder upsert. Returns (seen, new) counts for sync counters."""
    seen = len(records)
    # Semana 1: treat all as "new" for counter wiring; real DB upsert in later steps.
    return seen, seen


def emit_events(records: list[SourceRecord]) -> None:
    """Placeholder: tender_events emission later."""
    _ = records


def checkpoint(cursor: str | None, last_artifact_key: str | None) -> str | None:
    """Placeholder checkpoint: advance cursor to last artifact key when present."""
    return last_artifact_key if last_artifact_key is not None else cursor
