"""Modelos Pydantic en el límite del conector (Semana 1)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class SyncContext(BaseModel):
    """Contexto de una ejecución de sincronización de una fuente."""

    source_code: str
    run_id: str
    cursor: str | None = None
    started_at: datetime = Field(default_factory=_utc_now)


class RemoteArtifact(BaseModel):
    """Recurso/fichero remoto descubierto por el conector (aún no guardado como RAW)."""

    artifact_key: str
    source_url: str | None = None
    content_type: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class SourceRecord(BaseModel):
    """Un registro parseado de la fuente, antes de normalizar/upsert canónico.

    No debe colar en el modelo canónico nombres de campos propios de la fuente;
    el pipeline mapea este payload después.
    """

    source_record_id: str
    payload: dict[str, Any] = Field(default_factory=dict)
    recorded_at: datetime | None = None
