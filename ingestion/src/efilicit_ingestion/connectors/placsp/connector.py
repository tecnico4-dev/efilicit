"""SourceConnector PLACSP — discover ZIPs mensuales + fetch + parse Atom/CODICE.

Implementa el contrato Semana 1: el pipeline no conoce sindicaciones ni CODICE;
solo ve ``RemoteArtifact`` (ZIP) y ``SourceRecord``.

Discover construye URLs oficiales mes a mes (ventana from/to o solo ``as_of``).
No lista un HTML de índice: las rutas están documentadas y son estables.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from datetime import date

import httpx

from efilicit_ingestion.connectors.placsp.fetch import (
    DEFAULT_MAX_BYTES,
    DEFAULT_RETRY_ATTEMPTS,
    DEFAULT_TIMEOUT_SECONDS,
    FetchSettings,
    FetchTransport,
    download_bytes,
    sha256_hex,
)
from efilicit_ingestion.connectors.placsp.parser import parse_placsp_artifact
from efilicit_ingestion.connectors.placsp.urls import (
    PLACSP,
    PlacspSyndication,
    iter_year_months,
    monthly_package_filename,
    monthly_package_url,
    parse_year_month,
)
from efilicit_ingestion.models import RemoteArtifact, SourceRecord, SyncContext

# Sonda opcional: True si el paquete remoto parece disponible (p. ej. HEAD).
# Evita encolar meses que Hacienda aún no ha publicado.
UrlExists = Callable[[str], bool]

__all__ = [
    "PlacspConnector",
    "sha256_hex",
    "FetchSettings",
]


class PlacspConnector:
    """Conector Open Data PLACSP para sindicaciones Atom/CODICE en ZIP.

    Por defecto: perfiles alojados (``placsp`` / ``sindicacion_643``).
    Pasar ``syndication=PLACSP_AGREGADAS`` / ``PLACSP_MENORES`` reutiliza
    discover/fetch/parse con otra carpeta Hacienda (mismo formato).

    ``fetch_transport``: fixture/E2E sin red. ``url_exists``: saltar ZIPs ausentes.
    """

    def __init__(
        self,
        *,
        syndication: PlacspSyndication = PLACSP,
        from_year_month: str | None = None,
        to_year_month: str | None = None,
        as_of: date | None = None,
        url_exists: UrlExists | None = None,
        fetch_transport: FetchTransport | None = None,
        http_client: httpx.Client | None = None,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        max_bytes: int = DEFAULT_MAX_BYTES,
        retry_attempts: int = DEFAULT_RETRY_ATTEMPTS,
    ) -> None:
        """Configura sindicación, ventana de meses y política de descarga.

        - Sin from/to: descubre solo el mes de ``as_of`` (o hoy) — slice acotado.
        - Live: ZIPs pueden ser cientos de MiB → ``max_bytes`` alto por defecto.
        """
        self.syndication = syndication
        self.source_code = syndication.source_code
        self._from_year_month = from_year_month
        self._to_year_month = to_year_month
        self._as_of = as_of
        self._url_exists = url_exists
        self._fetch_transport = fetch_transport
        self._http_client = http_client
        self._fetch_settings = FetchSettings(
            timeout_seconds=timeout_seconds,
            max_bytes=max_bytes,
            retry_attempts=retry_attempts,
        )

    def discover(self, context: SyncContext) -> list[RemoteArtifact]:
        """Lista ZIPs mensuales de la ventana; respeta cursor de ``source_sync``."""
        start, end = self._resolve_window()
        artifacts: list[RemoteArtifact] = []
        feed = self.syndication

        for year, month in iter_year_months(start, end):
            artifact_key = monthly_package_filename(year, month, feed)
            if not self._is_after_cursor(artifact_key, context.cursor):
                continue

            source_url = monthly_package_url(year, month, feed)
            if self._url_exists is not None and not self._url_exists(source_url):
                continue

            artifacts.append(
                RemoteArtifact(
                    artifact_key=artifact_key,
                    source_url=source_url,
                    content_type="application/zip",
                    metadata={
                        "feed_base": feed.feed_base_name,
                        "sindicacion": feed.sindicacion,
                        "package_kind": "monthly",
                        "year": year,
                        "month": month,
                    },
                )
            )

        return artifacts

    def fetch(self, artifact: RemoteArtifact) -> bytes:
        """Descarga el ZIP; el RAW aún no se parsea (evidencia inmutable primero)."""
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
        return parse_placsp_artifact(raw, artifact)

    def _resolve_window(self) -> tuple[tuple[int, int], tuple[int, int]]:
        """Ventana [start, end] inclusiva; por defecto un solo mes (pivote)."""
        pivot = self._as_of or date.today()
        pivot_ym = (pivot.year, pivot.month)

        if self._from_year_month is None and self._to_year_month is None:
            return pivot_ym, pivot_ym

        start = (
            parse_year_month(self._from_year_month)
            if self._from_year_month is not None
            else pivot_ym
        )
        end = (
            parse_year_month(self._to_year_month)
            if self._to_year_month is not None
            else pivot_ym
        )
        return start, end

    @staticmethod
    def _is_after_cursor(artifact_key: str, cursor: str | None) -> bool:
        """Omite paquetes ya cubiertos por el cursor de sync.

        El cursor suele ser el último ``artifact_key`` procesado. El orden
        lexicográfico vale para nombres ``…_YYYYMM.zip`` (año/mes zero-padded).
        """
        if cursor is None:
            return True
        return artifact_key > cursor
