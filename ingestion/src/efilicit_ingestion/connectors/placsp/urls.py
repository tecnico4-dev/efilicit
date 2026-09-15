"""Official PLACSP syndication URI helpers (docs/sources/placsp*.md).

No HTML scraping: packages live at well-known paths.
Supports multiple Atom/CODICE syndications (perfiles vs agregadas, etc.).
"""

from __future__ import annotations

from dataclasses import dataclass

__all__ = [
    "PlacspSyndication",
    "PLACSP",
    "PLACSP_AGREGADAS",
    "PLACSP_SINDICACION_BASE",
    "FEED_BASE_NAME",
    "monthly_package_filename",
    "monthly_package_url",
    "yearly_package_filename",
    "yearly_package_url",
    "parse_year_month",
    "iter_year_months",
]


@dataclass(frozen=True, slots=True)
class PlacspSyndication:
    """One official PLACSP Open Data syndication dataset."""

    source_code: str
    sindicacion: str
    feed_base_name: str

    @property
    def base_url(self) -> str:
        return (
            "https://contrataciondelsectorpublico.gob.es/sindicacion/"
            f"sindicacion_{self.sindicacion}"
        )


# Semana 2 — perfiles alojados, sin menores (docs/sources/placsp.md).
PLACSP = PlacspSyndication(
    source_code="placsp",
    sindicacion="643",
    feed_base_name="licitacionesPerfilesContratanteCompleto3",
)

# Semana 3 — agregación CCAA/entes, sin menores (docs/sources/placsp_agregadas.md).
PLACSP_AGREGADAS = PlacspSyndication(
    source_code="placsp_agregadas",
    sindicacion="1044",
    feed_base_name="PlataformasAgregadasSinMenores",
)

# Backward-compatible aliases for the default (perfiles) syndication.
PLACSP_SINDICACION_BASE = PLACSP.base_url
FEED_BASE_NAME = PLACSP.feed_base_name


def monthly_package_filename(
    year: int,
    month: int,
    syndication: PlacspSyndication = PLACSP,
) -> str:
    """Stable artifact_key for a monthly ZIP package."""
    if month < 1 or month > 12:
        raise ValueError(f"month out of range: {month}")
    return f"{syndication.feed_base_name}_{year:04d}{month:02d}.zip"


def monthly_package_url(
    year: int,
    month: int,
    syndication: PlacspSyndication = PLACSP,
) -> str:
    return (
        f"{syndication.base_url}/"
        f"{monthly_package_filename(year, month, syndication)}"
    )


def yearly_package_filename(
    year: int,
    syndication: PlacspSyndication = PLACSP,
) -> str:
    """Stable artifact_key for a closed-year ZIP package."""
    return f"{syndication.feed_base_name}_{year:04d}.zip"


def yearly_package_url(
    year: int,
    syndication: PlacspSyndication = PLACSP,
) -> str:
    return (
        f"{syndication.base_url}/"
        f"{yearly_package_filename(year, syndication)}"
    )


def parse_year_month(value: str) -> tuple[int, int]:
    """Parse 'YYYY-MM' or 'YYYYMM' into (year, month)."""
    raw = value.strip()
    if len(raw) == 7 and raw[4] == "-":
        year_s, month_s = raw.split("-", 1)
        return int(year_s), int(month_s)
    if len(raw) == 6 and raw.isdigit():
        return int(raw[:4]), int(raw[4:6])
    raise ValueError(f"invalid year-month: {value!r}")


def iter_year_months(
    start: tuple[int, int],
    end: tuple[int, int],
) -> list[tuple[int, int]]:
    """Inclusive month range from start to end."""
    sy, sm = start
    ey, em = end
    if (sy, sm) > (ey, em):
        raise ValueError(f"start {start} is after end {end}")

    out: list[tuple[int, int]] = []
    y, m = sy, sm
    while (y, m) <= (ey, em):
        out.append((y, m))
        if m == 12:
            y, m = y + 1, 1
        else:
            m += 1
    return out
