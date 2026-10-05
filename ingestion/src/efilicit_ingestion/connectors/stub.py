"""Conector stub en memoria para tests de contrato (Semana 1; sin red).

Demuestra que el runner funciona con *cualquier* implementación de
``SourceConnector`` antes de existir PLACSP. No es una fuente de producto.
"""

from __future__ import annotations

import json
from typing import Iterable

from efilicit_ingestion.models import RemoteArtifact, SourceRecord, SyncContext


class StubSourceConnector:
    """Fuente falsa: un artefacto JSON fijo para CI / tests de pipeline.

    ``source_code = "stub"`` — no mezclar con fuentes reales en prod.
    """

    source_code: str = "stub"

    def discover(self, context: SyncContext) -> list[RemoteArtifact]:
        _ = context
        return [
            RemoteArtifact(
                artifact_key="stub-artifact-1",
                source_url="https://example.invalid/stub/artifact-1.json",
                content_type="application/json",
                metadata={"fixture": True},
            )
        ]

    def fetch(self, artifact: RemoteArtifact) -> bytes:
        """Devuelve JSON sintético (no hay descarga real)."""
        body = {
            "id": artifact.artifact_key,
            "title": "Stub tender for contract tests",
        }
        return json.dumps(body).encode("utf-8")

    def parse(
        self,
        raw: bytes,
        artifact: RemoteArtifact,
    ) -> Iterable[SourceRecord]:
        """Un ``SourceRecord`` por artefacto; id = campo ``id`` o el artifact_key."""
        data = json.loads(raw.decode("utf-8"))
        yield SourceRecord(
            source_record_id=str(data.get("id", artifact.artifact_key)),
            payload=data,
        )
