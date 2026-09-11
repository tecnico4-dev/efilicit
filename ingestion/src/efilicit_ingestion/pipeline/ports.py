"""Persistence ports used by the pipeline (Semana 1: in-memory; Semana 1 Paso 7: Postgres)."""

from __future__ import annotations

import hashlib
from typing import Protocol

from efilicit_ingestion.models import RemoteArtifact
from efilicit_ingestion.pipeline.paths import build_raw_storage_path
from efilicit_ingestion.pipeline.types import StoredArtifact, SyncRun, utc_now


class ArtifactStore(Protocol):
    def store(
        self,
        *,
        source_code: str,
        artifact: RemoteArtifact,
        raw: bytes,
    ) -> StoredArtifact:
        """Persist RAW bytes (or record metadata) and return path + checksum."""
        ...


class SyncRepository(Protocol):
    def start_run(self, *, source_code: str, run_id: str, cursor: str | None) -> SyncRun:
        ...

    def register_artifact(self, run: SyncRun, stored: StoredArtifact) -> None:
        ...

    def finish_run(
        self,
        run: SyncRun,
        *,
        status: str,
        error_message: str | None = None,
    ) -> SyncRun:
        ...


class InMemoryArtifactStore:
    """Stores RAW in memory and builds the Storage path convention."""

    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    def store(
        self,
        *,
        source_code: str,
        artifact: RemoteArtifact,
        raw: bytes,
    ) -> StoredArtifact:
        checksum = hashlib.sha256(raw).hexdigest()
        storage_path, _object_key = build_raw_storage_path(
            source_code,
            artifact.artifact_key,
        )
        self.objects[storage_path] = raw
        return StoredArtifact(
            artifact_key=artifact.artifact_key,
            checksum=checksum,
            storage_path=storage_path,
            byte_size=len(raw),
            content_type=artifact.content_type,
            source_url=artifact.source_url,
        )


class InMemorySyncRepository:
    """Tracks sync runs and artifacts in memory (no Postgres yet)."""

    def __init__(self) -> None:
        self.runs: dict[tuple[str, str], SyncRun] = {}

    def start_run(self, *, source_code: str, run_id: str, cursor: str | None) -> SyncRun:
        run = SyncRun(source_code=source_code, run_id=run_id, cursor=cursor)
        self.runs[(source_code, run_id)] = run
        return run

    def register_artifact(self, run: SyncRun, stored: StoredArtifact) -> None:
        run.artifacts.append(stored)
        run.last_artifact = stored.artifact_key
        run.checksum = stored.checksum

    def finish_run(
        self,
        run: SyncRun,
        *,
        status: str,
        error_message: str | None = None,
    ) -> SyncRun:
        run.status = status
        run.error_message = error_message
        run.finished_at = utc_now()
        return run
