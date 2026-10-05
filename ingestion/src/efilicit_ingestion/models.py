"""Modelos Pydantic en el límite del conector (Semana 1).

Separan lo que el conector conoce (artefacto / registro de fuente) de lo que
el modelo canónico en Postgres guarda después. Así la app no depende de
campos CODICE, SoQL, etc.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class SyncContext(BaseModel):
    """Contexto de una ejecución de sincronización de una fuente.

    ``cursor``: último ``artifact_key`` (u otro token) ya procesado; el
    discover lo usa para ser incremental. ``run_id`` identifica la fila en
    ``source_sync``.
    """

    source_code: str
    run_id: str
    cursor: str | None = None
    started_at: datetime = Field(default_factory=_utc_now)


class RemoteArtifact(BaseModel):
    """Recurso remoto descubierto (aún no guardado como RAW).

    ``artifact_key`` debe ser estable entre corridas (unique con ``source_code``
    en ``source_artifacts``). Ej.: nombre del ZIP mensual o key de página SODA.
    """

    artifact_key: str
    source_url: str | None = None
    content_type: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class SourceRecord(BaseModel):
    """Registro parseado de la fuente, antes de normalizar / upsert canónico.

    ``source_record_id`` alimenta el unique ``(source_code, source_tender_id)``.
    El ``payload`` puede ser fiel a la fuente; no colar esos nombres en las
    tablas canónicas — eso lo hace ``normalize`` → ``payload['canonical']``.
    """

    source_record_id: str
    payload: dict[str, Any] = Field(default_factory=dict)
    recorded_at: datetime | None = None
