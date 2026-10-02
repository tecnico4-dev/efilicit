"""Contrato SourceConnector — fijo en el qué, libre en el cómo (docs/01 §5)."""

from __future__ import annotations

from typing import Iterable, Protocol, runtime_checkable

# SyncContext = contexto de una sincronización;
# RemoteArtifact = paquete/fichero remoto descubierto;
# SourceRecord = licitación (u otro registro) ya parseado, aún no canónico.
from efilicit_ingestion.models import RemoteArtifact, SourceRecord, SyncContext


@runtime_checkable
class SourceConnector(Protocol):
    """Interfaz mínima de conector: discover → fetch → parse."""

    source_code: str

    def discover(self, context: SyncContext) -> list[RemoteArtifact]:
        """Lista artefactos remotos disponibles para este contexto de sync."""
        ...

    def fetch(self, artifact: RemoteArtifact) -> bytes:
        """Descarga los bytes en bruto de un artefacto."""
        ...

    def parse(
        self,
        raw: bytes,
        artifact: RemoteArtifact,
    ) -> Iterable[SourceRecord]:
        """Parsea el RAW en registros de fuente (previos al modelo canónico)."""
        ...
