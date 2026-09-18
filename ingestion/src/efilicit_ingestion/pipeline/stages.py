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
    """Map source payloads to canonical MVP fields (dates, amounts, codes, authority)."""
    from efilicit_ingestion.pipeline.canonical import normalize_records

    return normalize_records(records)


def enrich(records: list[SourceRecord]) -> list[SourceRecord]:
    """Placeholder: enrichment later."""
    return records


def resolve_identity(records: list[SourceRecord]) -> list[SourceRecord]:
    """Resolve contracting-authority identity confidence (NIF/CIF primary)."""
    from efilicit_ingestion.pipeline.canonical import resolve_identity_records

    return resolve_identity_records(records)


def deduplicate(
    records: list[SourceRecord],
    *,
    source_code: str | None = None,
    canonical_repo: object | None = None,
) -> list[SourceRecord]:
    """Cross-source matching: annotate ``payload['match']`` (Semana 4 Paso 5).

    Without a lookup repo, marks every record as ``unmatched``.
    Does not merge tenders yet — that is Paso 6 (upsert).
    """
    from efilicit_ingestion.pipeline.matching import MatchLookup, match_records

    lookup: MatchLookup | None = None
    if canonical_repo is not None and hasattr(
        canonical_repo, "find_match_candidates"
    ):
        lookup = canonical_repo  # type: ignore[assignment]

    return match_records(
        records,
        source_code=source_code or "",
        lookup=lookup,
    )


def quality_checks(records: list[SourceRecord]) -> list[SourceRecord]:
    """Placeholder: quality rules later."""
    return records


def upsert(
    records: list[SourceRecord],
    *,
    source_code: str,
    canonical_repo: object | None = None,
    artifact_id: str | None = None,
) -> tuple[int, int, int]:
    """Upsert canonical rows. Returns (seen, new, updated).

    Without a ``canonical_repo``, keeps Semana 1 counter wiring (all seen as new).
    """
    if canonical_repo is None:
        seen = len(records)
        return seen, seen, 0

    from efilicit_ingestion.pipeline.canonical_repo import CanonicalRepository

    repo = canonical_repo  # type: CanonicalRepository
    stats = repo.upsert_records(
        source_code=source_code,
        records=records,
        artifact_id=artifact_id,
    )
    return stats.seen, stats.new, stats.updated


def emit_events(records: list[SourceRecord]) -> None:
    """Events are written inside the canonical upsert (Paso 7)."""
    _ = records


def checkpoint(cursor: str | None, last_artifact_key: str | None) -> str | None:
    """Placeholder checkpoint: advance cursor to last artifact key when present."""
    return last_artifact_key if last_artifact_key is not None else cursor
