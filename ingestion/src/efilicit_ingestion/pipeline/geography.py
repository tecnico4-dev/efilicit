"""Geografía de lugar de ejecución: NUTS → CCAA (INE) y municipio opcional.

No confundir con ``source_code`` ni con la sede del organismo.
Ver ADR 018.
"""

from __future__ import annotations

from typing import Any

# NUTS-2 (ES + 2 dígitos) → código INE de CCAA.
_NUTS2_TO_CCAA: dict[str, str] = {
    "ES11": "12",  # Galicia
    "ES12": "03",  # Asturias
    "ES13": "06",  # Cantabria
    "ES21": "16",  # País Vasco
    "ES22": "15",  # Navarra
    "ES23": "17",  # La Rioja
    "ES24": "02",  # Aragón
    "ES30": "13",  # Madrid
    "ES41": "07",  # Castilla y León
    "ES42": "08",  # Castilla-La Mancha
    "ES43": "11",  # Extremadura
    "ES51": "09",  # Cataluña
    "ES52": "10",  # Comunitat Valenciana
    "ES53": "04",  # Illes Balears
    "ES61": "01",  # Andalucía
    "ES62": "14",  # Murcia
    "ES63": "18",  # Ceuta
    "ES64": "19",  # Melilla
    "ES70": "05",  # Canarias
}


def normalize_nuts_code(value: str | None) -> str | None:
    """Normaliza un código NUTS (trim, mayúsculas)."""
    if value is None:
        return None
    code = str(value).strip().upper().replace(" ", "")
    return code or None


def nuts_to_ccaa_code(nuts: str | None) -> str | None:
    """Deriva CCAA INE desde NUTS-2/NUTS-3 (p. ej. ES213 → ES21 → 16)."""
    code = normalize_nuts_code(nuts)
    if not code or not code.startswith("ES") or len(code) < 4:
        return None
    nuts2 = code[:4]
    return _NUTS2_TO_CCAA.get(nuts2)


def normalize_municipality_ine_code(value: str | None) -> str | None:
    """Código INE de municipio (5 dígitos). Rechaza basura."""
    if value is None:
        return None
    digits = "".join(ch for ch in str(value).strip() if ch.isdigit())
    if len(digits) == 5:
        return digits
    if len(digits) == 4:
        # A veces falta el 0 inicial de provincia.
        return digits.zfill(5)
    return None


def resolve_place_fields(
    *,
    nuts_code: str | None = None,
    municipality_code: str | None = None,
    ccaa_code: str | None = None,
) -> dict[str, str | None]:
    """Resuelve place_* canónicos.

    - Si hay municipio INE válido, se guarda; la CCAA puede venir explícita
      o quedar solo la derivada de NUTS (el catálogo geo_municipio enlaza CCAA).
    - CCAA: explícita > derivada de NUTS.
    """
    nuts = normalize_nuts_code(nuts_code)
    mun = normalize_municipality_ine_code(municipality_code)
    explicit_ccaa = (ccaa_code or "").strip() or None
    if explicit_ccaa is not None and len(explicit_ccaa) == 1:
        explicit_ccaa = explicit_ccaa.zfill(2)

    derived = nuts_to_ccaa_code(nuts)
    ccaa = explicit_ccaa or derived

    return {
        "place_nuts_code": nuts,
        "place_ccaa_code": ccaa,
        "place_municipality_code": mun,
    }


def place_from_canonical_raw(raw_or_canonical: dict[str, Any]) -> dict[str, str | None]:
    """Lee nuts / municipio opcionales del payload pre-canónico o canonical."""
    nuts = raw_or_canonical.get("nuts_code")
    if not nuts:
        nuts = None
        codes = raw_or_canonical.get("nuts_codes")
        if isinstance(codes, list) and codes:
            nuts = codes[0]

    mun = raw_or_canonical.get("municipality_ine_code") or raw_or_canonical.get(
        "place_municipality_code"
    )
    ccaa = raw_or_canonical.get("ccaa_code") or raw_or_canonical.get("place_ccaa_code")
    return resolve_place_fields(
        nuts_code=str(nuts) if nuts else None,
        municipality_code=str(mun) if mun else None,
        ccaa_code=str(ccaa) if ccaa else None,
    )
