"""PLACSP SourceConnector — Paso 2: discover monthly ZIP packages.

`fetch` / `parse` arrive in later Semana 2 steps.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from datetime import date

from efilicit_ingestion.connectors.placsp.urls import (
    FEED_BASE_NAME,
    iter_year_months,
    monthly_package_filename,
    monthly_package_url,
    parse_year_month,
)
from efilicit_ingestion.models import RemoteArtifact, SourceRecord, SyncContext

# Optional probe: return True if the remote package appears available.
UrlExists = Callable[[str], bool]


class PlacspConnector:
    """Discovers official sindicacion_643 monthly ZIP artifacts.

    Discovery uses well-known URI patterns from docs/sources/placsp.md.
    It does not scrape HTML indexes.
    """

    source_code: str = "placsp"

    def __init__(
        self,
        *,
        from_year_month: str | None = None,
        to_year_month: str | None = None,
        as_of: date | None = None,
        url_exists: UrlExists | None = None,
    ) -> None:
        """Configure the discovery window.

        - If neither from/to is set: discover the single month of ``as_of`` (or today).
        - If only one bound is set: treat the other as that same month / ``as_of``.
        - ``url_exists``: optional probe (e.g. HEAD) to skip missing packages.
        """
        self._from_year_month = from_year_month
        self._to_year_month = to_year_month
        self._as_of = as_of
        self._url_exists = url_exists

    def discover(self, context: SyncContext) -> list[RemoteArtifact]:
        start, end = self._resolve_window()
        artifacts: list[RemoteArtifact] = []

        for year, month in iter_year_months(start, end):
            artifact_key = monthly_package_filename(year, month)
            if not self._is_after_cursor(artifact_key, context.cursor):
                continue

            source_url = monthly_package_url(year, month)
            if self._url_exists is not None and not self._url_exists(source_url):
                continue

            artifacts.append(
                RemoteArtifact(
                    artifact_key=artifact_key,
                    source_url=source_url,
                    content_type="application/zip",
                    metadata={
                        "feed_base": FEED_BASE_NAME,
                        "sindicacion": "643",
                        "package_kind": "monthly",
                        "year": year,
                        "month": month,
                    },
                )
            )

        return artifacts

    def fetch(self, artifact: RemoteArtifact) -> bytes:
        raise NotImplementedError(
            "PLACSP fetch lands in Semana 2 Paso 3 (timeout/retry/checksum)."
        )

    def parse(
        self,
        raw: bytes,
        artifact: RemoteArtifact,
    ) -> Iterable[SourceRecord]:
        _ = raw, artifact
        raise NotImplementedError(
            "PLACSP parse lands in Semana 2 Paso 5 (Atom/CODICE fixtures)."
        )

    def _resolve_window(self) -> tuple[tuple[int, int], tuple[int, int]]:
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
        """Skip packages already covered by the sync cursor.

        Cursor is expected to be a previous ``artifact_key``. Lexicographic order
        works for monthly filenames (..._YYYYMM.zip).
        """
        if cursor is None:
            return True
        return artifact_key > cursor
