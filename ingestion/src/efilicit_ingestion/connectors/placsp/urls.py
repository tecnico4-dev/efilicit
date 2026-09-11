"""Official sindicacion_643 URI helpers (docs/sources/placsp.md).

No HTML scraping: packages live at well-known paths.
"""

from __future__ import annotations

PLACSP_SINDICACION_BASE = (
    "https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_643"
)
FEED_BASE_NAME = "licitacionesPerfilesContratanteCompleto3"


def monthly_package_filename(year: int, month: int) -> str:
    """Stable artifact_key for a monthly ZIP package."""
    if month < 1 or month > 12:
        raise ValueError(f"month out of range: {month}")
    return f"{FEED_BASE_NAME}_{year:04d}{month:02d}.zip"


def monthly_package_url(year: int, month: int) -> str:
    return f"{PLACSP_SINDICACION_BASE}/{monthly_package_filename(year, month)}"


def yearly_package_filename(year: int) -> str:
    """Stable artifact_key for a closed-year ZIP package."""
    return f"{FEED_BASE_NAME}_{year:04d}.zip"


def yearly_package_url(year: int) -> str:
    return f"{PLACSP_SINDICACION_BASE}/{yearly_package_filename(year)}"


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
