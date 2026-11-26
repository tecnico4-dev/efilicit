"""SourceConnector Socrata — discover páginas + fetch + parse (SODA JSON).

Implementa el contrato común (Semana 1): el pipeline no sabe de SoQL ni de
Catalunya; solo ve artefactos y ``SourceRecord``.

Discover no baja datos: lista ``RemoteArtifact`` (URL + key) acotados por
``max_pages`` / ``start_offset`` y, en Catalunya (ADR 025), por ventana
``since_days`` vía ``$where``. El RAW en Storage lo materializa el pipeline
incremental por fila, no la página entera.
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

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
    publication_since_where,
)
from efilicit_ingestion.models import RemoteArtifact, SourceRecord, SyncContext

__all__ = [
    "SocrataConnector",
    "sha256_hex",
    "FetchSettings",
    "madrid_since_iso",
]

_MADRID = ZoneInfo("Europe/Madrid")


def madrid_since_iso(since_days: int, *, now: datetime | None = None) -> str:
    """Inicio de ventana: medianoche Europe/Madrid hace ``since_days`` días."""
    if since_days < 1:
        raise ValueError("since_days must be >= 1 when building a date window")
    current = now.astimezone(_MADRID) if now is not None else datetime.now(_MADRID)
    start = (current - timedelta(days=since_days)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return start.strftime("%Y-%m-%dT%H:%M:%S")


class SocrataConnector:
    """Conector genérico SODA / Socrata Open Data.

    Por defecto: publicaciones PSCP de Catalunya (``CATALUNYA`` / ``ybgg-dgi6``).
    - Discover: páginas vía ``$limit`` / ``$offset`` (+ ``$where`` si ``since_days``).
    - Fetch: JSON de esa página (entrada al expand por fila).
    - Parse: filas → ``SourceRecord`` (mapeo Catalunya en el parser actual).

    ``fetch_transport`` permite E2E con fixture sin red (tests / dry-run Actions).
    """

    def __init__(
        self,
        *,
        dataset: SocrataDataset = CATALUNYA,
        page_size: int = 1000,
        max_pages: int = 1,
        start_offset: int = 0,
        since_days: int | None = 7,
        fetch_transport: FetchTransport | None = None,
        http_client: httpx.Client | None = None,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        max_bytes: int = DEFAULT_MAX_BYTES,
        retry_attempts: int = DEFAULT_RETRY_ATTEMPTS,
    ) -> None:
        """Configura paginación y ventana SoQL.

        - ``page_size``: ``$limit`` SODA (Catalunya tolera ~1000).
        - ``max_pages`` / ``start_offset``: paginación dentro del resultado filtrado.
        - ``since_days``: ventana ``data_publicacio_anunci`` (ADR 025). ``None`` o
          ``0`` desactiva ``$where`` (escape hatch de backfill).
        """
        if page_size < 1:
            raise ValueError("page_size must be >= 1")
        if max_pages < 1:
            raise ValueError("max_pages must be >= 1")
        if start_offset < 0:
            raise ValueError("start_offset must be >= 0")
        if since_days is not None and since_days < 0:
            raise ValueError("since_days must be >= 0 (0 = no date filter)")

        self.dataset = dataset
        self.source_code = dataset.source_code
        self._page_size = page_size
        self._max_pages = max_pages
        self._start_offset = start_offset
        self._since_days = since_days
        self._fetch_transport = fetch_transport
        self._http_client = http_client
        self._fetch_settings = FetchSettings(
            timeout_seconds=timeout_seconds,
            max_bytes=max_bytes,
            retry_attempts=retry_attempts,
        )

    def discover(self, context: SyncContext) -> list[RemoteArtifact]:
        """Lista páginas a bajar; respeta cursor de sync si ya vimos keys anteriores."""
        where: str | None = None
        since_iso: str | None = None
        if self._since_days and self._since_days > 0:
            since_iso = madrid_since_iso(self._since_days)
            where = publication_since_where(since_iso)

        artifacts: list[RemoteArtifact] = []
        offset = self._start_offset
        for _ in range(self._max_pages):
            artifact_key = page_artifact_key(
                self.dataset, offset=offset, limit=self._page_size
            )
            if not self._is_after_cursor(artifact_key, context.cursor):
                # Página ya cubierta: avanzamos offset igual para no redescubrirla.
                offset += self._page_size
                continue

            metadata: dict[str, object] = {
                "domain": self.dataset.domain,
                "dataset_id": self.dataset.dataset_id,
                "offset": offset,
                "limit": self._page_size,
                "order_by": self.dataset.order_by,
                "raw_kind": "socrata_page",
            }
            if where is not None and since_iso is not None:
                metadata["where"] = where
                metadata["since_iso"] = since_iso
                metadata["since_days"] = self._since_days

            artifacts.append(
                RemoteArtifact(
                    artifact_key=artifact_key,
                    source_url=page_resource_url(
                        self.dataset,
                        offset=offset,
                        limit=self._page_size,
                        where=where,
                    ),
                    content_type="application/json",
                    metadata=metadata,
                )
            )
            offset += self._page_size
        return artifacts

    def fetch(self, artifact: RemoteArtifact) -> bytes:
        """Descarga el JSON de la página; el RAW por fila lo hace el pipeline 025."""
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
        """True si la página es posterior al cursor de ``source_sync``.

        Los keys llevan offset zero-padded: el orden lexicográfico coincide
        con el orden de paginación.
        """
        if cursor is None:
            return True
        return artifact_key > cursor
