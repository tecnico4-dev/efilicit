"""Contrato ``SourceConnector`` — fijo en el *qué*, libre en el *cómo* (docs/01 §5).

Toda fuente real (PLACSP, Socrata, Euskadi…) implementa esta interfaz.
El pipeline / la web **no** importan parsers ni URLs de cada portal: solo
consumen artefactos y registros a través de este contrato.

Flujo mínimo por sync: ``discover`` → ``fetch`` → ``parse``.
"""

from __future__ import annotations

from typing import Iterable, Protocol, runtime_checkable

# SyncContext = una corrida (fuente + run_id + cursor).
# RemoteArtifact = unidad de evidencia a bajar (ZIP, página JSON…).
# SourceRecord = fila ya parseada, aún no canónica.
from efilicit_ingestion.models import RemoteArtifact, SourceRecord, SyncContext


@runtime_checkable
class SourceConnector(Protocol):
    """Interfaz mínima de conector: discover → fetch → parse.

    ``source_code`` identifica la fuente en ``source_sync`` / ``tender_sources``
    (p. ej. ``placsp``, ``catalunya``). Debe ser estable entre corridas.
    """

    source_code: str

    def discover(self, context: SyncContext) -> list[RemoteArtifact]:
        """Lista artefactos remotos disponibles para este contexto de sync.

        No descarga aún: solo keys/URLs. Respeta ``context.cursor`` cuando
        la fuente es incremental (omitir lo ya procesado).
        """
        ...

    def fetch(self, artifact: RemoteArtifact) -> bytes:
        """Descarga los bytes en bruto (evidencia RAW) de un artefacto."""
        ...

    def parse(
        self,
        raw: bytes,
        artifact: RemoteArtifact,
    ) -> Iterable[SourceRecord]:
        """Parsea el RAW en registros de fuente (previos al modelo canónico).

        El payload puede usar campos de la fuente; ``normalize`` los traduce
        después. No escribir en DB aquí.
        """
        ...
