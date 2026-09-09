"""Pydantic models at the connector boundary (Semana 1)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class SyncContext(BaseModel):
    """Context for one synchronization run of a source."""

    source_code: str
    run_id: str
    cursor: str | None = None
    started_at: datetime = Field(default_factory=_utc_now)


class RemoteArtifact(BaseModel):
    """A remote file/resource discovered by a connector (not yet stored as RAW)."""

    artifact_key: str
    source_url: str | None = None
    content_type: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class SourceRecord(BaseModel):
    """One parsed record from a source, before canonical normalize/upsert.

    Must not leak source-specific field names into the canonical DB model;
    the pipeline maps this payload later.
    """

    source_record_id: str
    payload: dict[str, Any] = Field(default_factory=dict)
    recorded_at: datetime | None = None
