"""Helper fetch → validate → store_raw (Semana 2 Paso 4).

Atajo para tests/docs del vertical slice: evidencia RAW **antes** de parsear.
El runner de pipeline hace el mismo orden; este helper aísla solo esa terna.
"""

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
    """Descarga un artefacto, lo valida y persiste la evidencia RAW.

    No parsea ni hace upsert canónico (pasos posteriores). Así el RAW queda
    aunque falle el parser después.
    """
    raw = connector.fetch(artifact)
    raw = stages.validate_artifact(raw, artifact)
    return stages.store_raw(
        source_code=connector.source_code,
        artifact=artifact,
        raw=raw,
        store=artifact_store,
    )
