"""In-memory stub connector for contract tests (no network)."""

from __future__ import annotations

import json
from typing import Iterable

from efilicit_ingestion.models import RemoteArtifact, SourceRecord, SyncContext


class StubSourceConnector:
    """Fake source used to prove the SourceConnector contract in Semana 1."""

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
