"""Conector stub en memoria para tests de contrato (sin red)."""

from __future__ import annotations

import json
from typing import Iterable

from efilicit_ingestion.models import RemoteArtifact, SourceRecord, SyncContext


class StubSourceConnector:
    """Fuente falsa para demostrar el contrato SourceConnector en Semana 1."""

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
        data = json.loads(raw.decode("utf-8"))
        yield SourceRecord(
            source_record_id=str(data.get("id", artifact.artifact_key)),
            payload=data,
        )
