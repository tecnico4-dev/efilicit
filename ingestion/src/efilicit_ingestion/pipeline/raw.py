"""Fetch → validate → store_raw helper (Semana 2 Paso 4)."""

from __future__ import annotations

from efilicit_ingestion.connectors.protocol import SourceConnector
from efilicit_ingestion.models import RemoteArtifact
from efilicit_ingestion.pipeline import stages
from efilicit_ingestion.pipeline.ports import ArtifactStore
from efilicit_ingestion.pipeline.types import StoredArtifact


def fetch_validate_and_store_raw(
    connector: SourceConnector,
    artifact: RemoteArtifact,
    *,
    artifact_store: ArtifactStore,
) -> StoredArtifact:
    """Download one artifact, validate it, and persist RAW evidence.

    Does not parse or upsert canonical rows (later Semana 2 steps).
    """
    raw = connector.fetch(artifact)
    raw = stages.validate_artifact(raw, artifact)
    return stages.store_raw(
        source_code=connector.source_code,
        artifact=artifact,
        raw=raw,
        store=artifact_store,
    )
