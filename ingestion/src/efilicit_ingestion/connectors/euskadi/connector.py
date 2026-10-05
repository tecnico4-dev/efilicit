"""SourceConnector Euskadi — discover páginas + fetch + parse (KontratazioA REST)."""

from __future__ import annotations

from collections.abc import Iterable

import httpx

from efilicit_ingestion.connectors.euskadi.fetch import (
    DEFAULT_MAX_BYTES,
    DEFAULT_RETRY_ATTEMPTS,
    DEFAULT_TIMEOUT_SECONDS,
    FetchSettings,
    FetchTransport,
    download_bytes,
    sha256_hex,
)
from efilicit_ingestion.connectors.euskadi.parser import parse_euskadi_artifact
from efilicit_ingestion.connectors.euskadi.urls import (
    EUSKADI,
    EuskadiDataset,
    page_artifact_key,
    page_resource_url,
)
from efilicit_ingestion.models import RemoteArtifact, SourceRecord, SyncContext

__all__ = [
    "EuskadiConnector",
    "sha256_hex",
    "FetchSettings",
]


class EuskadiConnector:
    """Conector REST KontratazioA / Open Data Euskadi (``contracting-notices``).

    Discover lista páginas vía ``currentPage`` (tamaño de página fijo = 10).
    """

    def __init__(
        self,
        *,
        dataset: EuskadiDataset = EUSKADI,
        max_pages: int = 1,
        start_page: int = 1,
        fetch_transport: FetchTransport | None = None,
        http_client: httpx.Client | None = None,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        max_bytes: int = DEFAULT_MAX_BYTES,
        retry_attempts: int = DEFAULT_RETRY_ATTEMPTS,
    ) -> None:
        if max_pages < 1:
            raise ValueError("max_pages must be >= 1")
        if start_page < 1:
            raise ValueError("start_page must be >= 1")

        self.dataset = dataset
        self.source_code = dataset.source_code
        self._max_pages = max_pages
        self._start_page = start_page
        self._fetch_transport = fetch_transport
        self._http_client = http_client
        self._fetch_settings = FetchSettings(
            timeout_seconds=timeout_seconds,
            max_bytes=max_bytes,
            retry_attempts=retry_attempts,
        )

    def discover(self, context: SyncContext) -> list[RemoteArtifact]:
        artifacts: list[RemoteArtifact] = []
        for page in range(self._start_page, self._start_page + self._max_pages):
            artifact_key = page_artifact_key(self.dataset, page=page)
            if not self._is_after_cursor(artifact_key, context.cursor):
                continue
            artifacts.append(
                RemoteArtifact(
                    artifact_key=artifact_key,
                    source_url=page_resource_url(self.dataset, page=page),
                    content_type="application/json",
                    metadata={
                        "collection": self.dataset.collection,
                        "current_page": page,
                        "items_per_page": 10,
                    },
                )
            )
        return artifacts

    def fetch(self, artifact: RemoteArtifact) -> bytes:
        if not artifact.source_url:
            raise ValueError(
                f"artifact {artifact.artifact_key!r} is missing source_url"
            )
        return download_bytes(
            artifact.source_url,
            settings=self._fetch_settings,
            transport=self._fetch_transport,
            http_client=self._http_client,
        )

    def parse(
        self,
        raw: bytes,
        artifact: RemoteArtifact,
    ) -> Iterable[SourceRecord]:
        return parse_euskadi_artifact(raw, artifact)

    @staticmethod
    def _is_after_cursor(artifact_key: str, cursor: str | None) -> bool:
        """Omite páginas ya cubiertas por el cursor."""
        if cursor is None:
            return True
        return artifact_key > cursor
