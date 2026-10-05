"""Tipos compartidos del pipeline común de ingesta (Semana 1+).

Dataclasses agnósticas de DB: el runner y los tests hablan este idioma;
Postgres / memoria rellenan los mismos campos.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True)
class StoredArtifact:
    """Resultado de ``store_raw``: evidencia RAW referenciable (checksum + ruta).

    ``storage_path`` es lo que suele ir a ``source_artifacts`` (p. ej.
    ``raw/placsp/…/file.zip``), aunque el store sea solo memoria.
    """

    artifact_key: str
    checksum: str
    storage_path: str
    byte_size: int
    content_type: str | None = None
    source_url: str | None = None


@dataclass
class SyncRun:
    """Vista en memoria / agnóstica de DB de una fila ``source_sync``.

    Contadores y cursor los actualiza el runner; ``finish_run`` los persiste.
    """

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
    """Resultado de una ejecución del pipeline (CLI, tests, Actions)."""

    sync: SyncRun
    records_processed: int
    stored_artifacts: list[StoredArtifact]
