"""Etapas comunes del pipeline (docs/01 §5).

Semana 1: validate/store_raw reales; el resto se rellena al integrar cada fuente
(normalize, identidad, matching, upsert canónico).
"""

from __future__ import annotations

from efilicit_ingestion.models import RemoteArtifact, SourceRecord
from efilicit_ingestion.pipeline.ports import ArtifactStore
from efilicit_ingestion.pipeline.types import StoredArtifact


def validate_artifact(raw: bytes, artifact: RemoteArtifact) -> bytes:
    """Rechaza payloads vacíos / claramente inválidos antes de RAW / parse."""
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
    """Guarda el RAW y devuelve checksum + ruta lógica."""
    return store.store(source_code=source_code, artifact=artifact, raw=raw)


def normalize(records: list[SourceRecord]) -> list[SourceRecord]:
    """Mapea payloads de fuente a campos canónicos MVP (fechas, importes, CPV, organismo)."""
    from efilicit_ingestion.pipeline.canonical import normalize_records

    return normalize_records(records)


def enrich(records: list[SourceRecord]) -> list[SourceRecord]:
    """Reservado: enriquecimientos posteriores."""
    return records


def resolve_identity(records: list[SourceRecord]) -> list[SourceRecord]:
    """Resuelve confianza de identidad del organismo (NIF/CIF como señal primaria)."""
    from efilicit_ingestion.pipeline.canonical import resolve_identity_records

    return resolve_identity_records(records)


def deduplicate(
    records: list[SourceRecord],
    *,
    source_code: str | None = None,
    canonical_repo: object | None = None,
) -> list[SourceRecord]:
    """Matching multi-fuente: anota ``payload['match']`` (Semana 4 Paso 5).

    Sin repo de lookup, marca todo como ``unmatched``.
    No fusiona tenders aquí: eso es el upsert (Paso 6).
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
    """Reservado: reglas de calidad posteriores."""
    return records


def upsert(
    records: list[SourceRecord],
    *,
    source_code: str,
    canonical_repo: object | None = None,
    artifact_id: str | None = None,
) -> tuple[int, int, int]:
    """Upsert canónico. Devuelve (vistos, nuevos, actualizados).

    Sin ``canonical_repo``, mantiene el cableado Semana 1 (todo visto cuenta como nuevo).
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
    """Los eventos se escriben dentro del upsert canónico."""
    _ = records


def checkpoint(cursor: str | None, last_artifact_key: str | None) -> str | None:
    """Checkpoint mínimo: avanza el cursor a la última artifact_key si existe."""
    return last_artifact_key if last_artifact_key is not None else cursor
