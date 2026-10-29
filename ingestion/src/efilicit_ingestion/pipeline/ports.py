"""Puertos de persistencia del pipeline (Semana 1).

El runner depende de protocolos, no de Postgres ni de Supabase Storage.
Así los tests usan implementaciones en memoria y la prod cablea Postgres /
Storage sin cambiar el orquestador.

- ``ArtifactStore``: evidencia RAW (bytes + checksum + ruta).
- ``SyncRepository``: bitácora ``source_sync`` / ``source_artifacts``.
"""

from __future__ import annotations

import hashlib
from typing import Protocol

from efilicit_ingestion.models import RemoteArtifact
from efilicit_ingestion.pipeline.paths import build_raw_storage_path
from efilicit_ingestion.pipeline.types import StoredArtifact, SyncRun, utc_now


class ArtifactStore(Protocol):
    """Dónde se guarda el RAW (Storage real o almacén en memoria para tests)."""

    def store(
        self,
        *,
        source_code: str,
        artifact: RemoteArtifact,
        raw: bytes,
    ) -> StoredArtifact:
        """Persiste bytes RAW (o solo metadatos) y devuelve ruta + checksum."""
        ...


class SyncRepository(Protocol):
    """Bitácora de ejecución: apertura/cierre de run y registro de artefactos.

    No es el modelo canónico de licitaciones: solo operativa ETL (ADR 003:
    tablas privadas; fallos → ``finish_run(..., failed)``, no ``public.errors``).
    """

    def start_run(self, *, source_code: str, run_id: str, cursor: str | None) -> SyncRun:
        """Abre un run ``running`` (unique ``source_code`` + ``run_id``)."""
        ...

    def register_artifact(self, run: SyncRun, stored: StoredArtifact) -> str | None:
        """Guarda metadatos del artefacto; devuelve id en DB si existe."""
        ...

    def find_artifact_by_checksum(
        self,
        source_code: str,
        checksum: str,
    ) -> tuple[str, StoredArtifact] | None:
        """Lookup content-addressed (ADR 022). ``None`` si no hay fila."""
        ...

    def finish_run(
        self,
        run: SyncRun,
        *,
        status: str,
        error_message: str | None = None,
    ) -> SyncRun:
        """Cierra el run (``success`` / ``failed`` / …) con contadores actuales."""
        ...


class InMemoryArtifactStore:
    """RAW en memoria + misma convención de ruta que Storage (tests / dry-run).

    No sube a Supabase; sí genera ``storage_path`` coherente para asserts.
    """

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
    """Runs y artefactos solo en memoria (sin Postgres).

    Útil en dry-run / unit tests del runner sin arrancar Supabase.
    """

    def __init__(self) -> None:
        self.runs: dict[tuple[str, str], SyncRun] = {}
        self.artifacts_by_checksum: dict[tuple[str, str], tuple[str, StoredArtifact]] = {}
        self._next_id = 1

    def start_run(self, *, source_code: str, run_id: str, cursor: str | None) -> SyncRun:
        run = SyncRun(source_code=source_code, run_id=run_id, cursor=cursor)
        self.runs[(source_code, run_id)] = run
        return run

    def register_artifact(self, run: SyncRun, stored: StoredArtifact) -> str | None:
        run.artifacts.append(stored)
        run.last_artifact = stored.artifact_key
        run.checksum = stored.checksum
        key = (run.source_code, stored.checksum)
        existing = self.artifacts_by_checksum.get(key)
        if existing is not None:
            return existing[0]
        artifact_id = f"mem-{self._next_id}"
        self._next_id += 1
        self.artifacts_by_checksum[key] = (artifact_id, stored)
        return artifact_id

    def find_artifact_by_checksum(
        self,
        source_code: str,
        checksum: str,
    ) -> tuple[str, StoredArtifact] | None:
        return self.artifacts_by_checksum.get((source_code, checksum))

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
