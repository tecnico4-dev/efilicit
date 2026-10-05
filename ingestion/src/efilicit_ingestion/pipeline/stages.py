"""Etapas comunes del pipeline (docs/01 §5) — nacidas en Semana 1.

Semana 1 fijó el esqueleto (validate / store_raw / stubs de etapas + upsert
sin canónico). Semana 2 rellenó normalize / identidad / upsert real; Semana 4
el matching. El runner llama siempre el mismo orden.
"""

from __future__ import annotations

from efilicit_ingestion.models import RemoteArtifact, SourceRecord
from efilicit_ingestion.pipeline.ports import ArtifactStore
from efilicit_ingestion.pipeline.types import StoredArtifact


def validate_artifact(raw: bytes, artifact: RemoteArtifact) -> bytes:
    """Rechaza payloads vacíos / claramente inválidos antes de RAW / parse.

    Para ZIPs PLACSP comprueba cabecera ``PK`` (evita guardar HTML de error
    como si fuera el paquete mensual).
    """
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
    """Persiste evidencia RAW (Storage o memoria) y devuelve checksum + ruta."""
    return store.store(source_code=source_code, artifact=artifact, raw=raw)


def normalize(records: list[SourceRecord]) -> list[SourceRecord]:
    """Mapea payloads de fuente a ``payload['canonical']`` tipado (Semana 2)."""
    from efilicit_ingestion.pipeline.canonical import normalize_records

    return normalize_records(records)


def enrich(records: list[SourceRecord]) -> list[SourceRecord]:
    """Reservado: enriquecimientos posteriores (no usado en el MVP actual)."""
    return records


def resolve_identity(records: list[SourceRecord]) -> list[SourceRecord]:
    """Confianza del organismo: NIF/CIF HIGH; nunca el nombre solo como id."""
    from efilicit_ingestion.pipeline.canonical import resolve_identity_records

    return resolve_identity_records(records)


def deduplicate(
    records: list[SourceRecord],
    *,
    source_code: str | None = None,
    canonical_repo: object | None = None,
) -> list[SourceRecord]:
    """Etapa de pipeline: matching multi-fuente (Semana 4 Paso 5).

    Antes era un pass-through. Ahora delega en ``matching.match_records`` para
    anotar ``payload['match']``. Sigue **sin** escribir en DB ni fusionar:
    el upsert (Paso 6) interpreta ``auto`` / ``pending`` / ``unmatched``.

    Si el repo no expone ``find_match_candidates``, todo queda ``unmatched``
    (p. ej. dry-run mínimo o repo antiguo).
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
    """Reservado: reglas de calidad posteriores (Semana 1 dejó el gancho)."""
    return records


def upsert(
    records: list[SourceRecord],
    *,
    source_code: str,
    canonical_repo: object | None = None,
    artifact_id: str | None = None,
) -> tuple[int, int, int]:
    """Upsert canónico. Devuelve ``(vistos, nuevos, actualizados)``.

    Sin ``canonical_repo`` (cableado Semana 1 / stub): todo lo visto cuenta
    como ``new`` — sirve para ejercitar bitácora sin tablas canónicas llenas.
    Con repo (Semana 2+): idempotencia real por ``(source_code, source_tender_id)``.
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
    """Hook Semana 1: los eventos se escriben dentro del upsert canónico (S2)."""
    _ = records


def checkpoint(cursor: str | None, last_artifact_key: str | None) -> str | None:
    """Avanza el cursor al último ``artifact_key`` procesado (incremental)."""
    return last_artifact_key if last_artifact_key is not None else cursor
