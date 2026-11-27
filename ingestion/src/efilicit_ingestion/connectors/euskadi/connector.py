"""SourceConnector Euskadi — discover páginas + fetch + parse (KontratazioA REST).

Igual que Socrata a nivel de contrato: el pipeline ve artefactos y registros.
La diferencia es la paginación (``currentPage``, 10 ítems/página) y el shape
JSON (``{items:[...]}`` en el parser, no un array raíz).
"""

from __future__ import annotations

import json
import sys
from collections.abc import Iterable
from typing import Any

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
from efilicit_ingestion.connectors.euskadi.recent_window import find_first_dated_page
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

    Discover lista páginas 1-based; fetch baja el JSON; parse mapea ``items[]``.
    Con ``auto_recent=True`` (live) localiza la primera página con fechas de
    publicación y lee ``max_pages`` desde ahí (ADR 025 enmendado).
    """

    def __init__(
        self,
        *,
        dataset: EuskadiDataset = EUSKADI,
        max_pages: int = 1,
        start_page: int = 1,
        auto_recent: bool = False,
        fetch_transport: FetchTransport | None = None,
        http_client: httpx.Client | None = None,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        max_bytes: int = DEFAULT_MAX_BYTES,
        retry_attempts: int = DEFAULT_RETRY_ATTEMPTS,
    ) -> None:
        """Ventana de discover: fija (``start_page``) o auto (zona con fechas)."""
        if max_pages < 1:
            raise ValueError("max_pages must be >= 1")
        if start_page < 1:
            raise ValueError("start_page must be >= 1")

        self.dataset = dataset
        self.source_code = dataset.source_code
        self._max_pages = max_pages
        self._start_page = start_page
        self._auto_recent = auto_recent
        self._fetch_transport = fetch_transport
        self._http_client = http_client
        self._fetch_settings = FetchSettings(
            timeout_seconds=timeout_seconds,
            max_bytes=max_bytes,
            retry_attempts=retry_attempts,
        )
        self._resolved_recent_start: int | None = None

    def discover(self, context: SyncContext) -> list[RemoteArtifact]:
        """Lista páginas de la ventana; en auto_recent ignora cursor (checksum)."""
        start = self._start_page
        if self._auto_recent:
            start = self._resolve_recent_start_page()
            self._resolved_recent_start = start

        artifacts: list[RemoteArtifact] = []
        for page in range(start, start + self._max_pages):
            artifact_key = page_artifact_key(self.dataset, page=page)
            if not self._auto_recent and not self._is_after_cursor(
                artifact_key, context.cursor
            ):
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
                        "auto_recent": self._auto_recent,
                        "recent_start_page": start if self._auto_recent else None,
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

    def _resolve_recent_start_page(self) -> int:
        """Binary search de la primera página con fechas (una vez por corrida)."""
        if self._resolved_recent_start is not None:
            return self._resolved_recent_start

        def fetch_page(page: int) -> dict[str, Any]:
            url = page_resource_url(self.dataset, page=page)
            raw = download_bytes(
                url,
                settings=self._fetch_settings,
                transport=self._fetch_transport,
                http_client=self._http_client,
            )
            payload = json.loads(raw.decode("utf-8"))
            if not isinstance(payload, dict):
                raise RuntimeError(
                    f"euskadi page {page}: expected JSON object, got {type(payload)}"
                )
            return payload

        meta = fetch_page(1)
        total_pages = meta.get("totalPages")
        if total_pages is None:
            # Algunos payloads usan totalItems / 10.
            total_items = meta.get("totalItems")
            if isinstance(total_items, int) and total_items > 0:
                total_pages = (total_items + 9) // 10
            else:
                raise RuntimeError(
                    "euskadi recent window: page 1 missing totalPages/totalItems"
                )
        if not isinstance(total_pages, int) or total_pages < 1:
            raise RuntimeError(
                f"euskadi recent window: invalid totalPages={total_pages!r}"
            )

        start = find_first_dated_page(
            total_pages=total_pages,
            fetch_page=fetch_page,
        )
        self._resolved_recent_start = start
        print(
            f"euskadi auto_recent: start_page={start} total_pages={total_pages} "
            f"max_pages={self._max_pages}",
            file=sys.stderr,
        )
        return start

    @staticmethod
    def _is_after_cursor(artifact_key: str, cursor: str | None) -> bool:
        """Orden lexicográfico del key (page zero-padded) = orden de páginas."""
        if cursor is None:
            return True
        return artifact_key > cursor
