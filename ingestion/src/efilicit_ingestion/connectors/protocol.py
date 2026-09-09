"""SourceConnector contract — fixed what, free how (docs/01 §5)."""

from __future__ import annotations

from typing import Iterable, Protocol, runtime_checkable

from efilicit_ingestion.models import RemoteArtifact, SourceRecord, SyncContext


@runtime_checkable
class SourceConnector(Protocol):
    """Minimal connector interface: discover → fetch → parse."""

    source_code: str

    def discover(self, context: SyncContext) -> list[RemoteArtifact]:
        """List remote artifacts available for this sync context."""
        ...

    def fetch(self, artifact: RemoteArtifact) -> bytes:
        """Download raw bytes for one artifact."""
        ...

    def parse(
        self,
        raw: bytes,
        artifact: RemoteArtifact,
    ) -> Iterable[SourceRecord]:
        """Parse raw bytes into source records (pre-canonical)."""
        ...
