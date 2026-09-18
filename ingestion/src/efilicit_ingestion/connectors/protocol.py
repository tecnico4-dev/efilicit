"""SourceConnector contract — fixed what, free how (docs/01 §5)."""

from __future__ import annotations

from typing import Iterable, Protocol, runtime_checkable

# De los siguientes: SyncContext es el contexto de la última sincronización, RemoteArtifact el paquete concreto y SourceRecord la licitación leída.
from efilicit_ingestion.models import RemoteArtifact, SourceRecord, SyncContext  # RESUMEN: Paquete = RemoteArtifact. Licitación = SourceRecord.


# Protocolo que siguen todos los conectores (mismos pasos comunes)
@runtime_checkable
class SourceConnector(Protocol):
    """Minimal connector interface: discover → fetch → parse."""

    source_code: str

    # ¿Qué hay nuevo en la web para poder bajarse?
    def discover(self, context: SyncContext) -> list[RemoteArtifact]:
        """List remote artifacts available for this sync context."""
        ...

    # Descargar los archivos en bruto que discover ha encontrado.
    def fetch(self, artifact: RemoteArtifact) -> bytes:
        """Download raw bytes for one artifact."""
        ...

    # Parsear (sacar las licitaciones de) los archivos en bruto.
    def parse(
        self,
        raw: bytes,
        artifact: RemoteArtifact,
    ) -> Iterable[SourceRecord]:
        """Parse raw bytes into source records (pre-canonical)."""
        ...
