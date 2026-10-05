"""SourceConnector Socrata — discover páginas + fetch + parse (SODA JSON)."""

from __future__ import annotations

from collections.abc import Iterable

import httpx

from efilicit_ingestion.connectors.socrata.fetch import (
    DEFAULT_MAX_BYTES,
    DEFAULT_RETRY_ATTEMPTS,
    DEFAULT_TIMEOUT_SECONDS,
    FetchSettings,
    FetchTransport,
    download_bytes,
    sha256_hex,
)
from efilicit_ingestion.connectors.socrata.parser import parse_socrata_artifact
from efilicit_ingestion.connectors.socrata.urls import (
    CATALUNYA,
    SocrataDataset,
    page_artifact_key,
    page_resource_url,
)
from efilicit_ingestion.models import RemoteArtifact, SourceRecord, SyncContext

__all__ = [
    "SocrataConnector",
    "sha256_hex",
    "FetchSettings",
]


class SocrataConnector:
    """Conector genérico SODA / Socrata Open Data.

    Por defecto: publicaciones PSCP de Catalunya (``CATALUNYA`` / ``ybgg-dgi6``).
    Discover lista páginas vía ``$limit`` / ``$offset``; fetch baja el JSON;
    parse mapea filas a ``SourceRecord`` (mapeo Catalunya para este dataset).
    """

    def __init__(
        self,
        *,
        dataset: SocrataDataset = CATALUNYA,
        page_size: int = 1000,
        max_pages: int = 1,
        start_offset: int = 0,
        fetch_transport: FetchTransport | None = None,
        http_client: httpx.Client | None = None,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        max_bytes: int = DEFAULT_MAX_BYTES,
        retry_attempts: int = DEFAULT_RETRY_ATTEMPTS,
    ) -> None:
        if page_size < 1:
            raise ValueError("page_size must be >= 1")
        if max_pages < 1:
            raise ValueError("max_pages must be >= 1")
        if start_offset < 0:
            raise ValueError("start_offset must be >= 0")

        self.dataset = dataset
        self.source_code = dataset.source_code
        self._page_size = page_size
        self._max_pages = max_pages
        self._start_offset = start_offset
        self._fetch_transport = fetch_transport
        self._http_client = http_client
        self._fetch_settings = FetchSettings(
            timeout_seconds=timeout_seconds,
            max_bytes=max_bytes,
            retry_attempts=retry_attempts,
        )

    def discover(self, context: SyncContext) -> list[RemoteArtifact]:
        artifacts: list[RemoteArtifact] = []
        offset = self._start_offset
        for _ in range(self._max_pages):
            artifact_key = page_artifact_key(
                self.dataset, offset=offset, limit=self._page_size
            )
            if not self._is_after_cursor(artifact_key, context.cursor):
                offset += self._page_size
                continue

            artifacts.append(
                RemoteArtifact(
                    artifact_key=artifact_key,
                    source_url=page_resource_url(
                        self.dataset, offset=offset, limit=self._page_size
                    ),
                    content_type="application/json",
                    metadata={
                        "domain": self.dataset.domain,
                        "dataset_id": self.dataset.dataset_id,
                        "offset": offset,
                        "limit": self._page_size,
                        "order_by": self.dataset.order_by,
                    },
                )
            )
            offset += self._page_size
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
        return parse_socrata_artifact(raw, artifact)

    @staticmethod
    def _is_after_cursor(artifact_key: str, cursor: str | None) -> bool:
        """Omite páginas ya cubiertas por el cursor (orden lexicográfico del key)."""
        if cursor is None:
            return True
        return artifact_key > cursor
