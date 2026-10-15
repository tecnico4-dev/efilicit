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

# Provincia INE (2 dígitos del municipio) → CCAA INE (geo_ccaa.code).
_PROVINCE_TO_CCAA: dict[str, str] = {
    "01": "16",  # Álava → País Vasco
    "02": "08",  # Albacete → Castilla-La Mancha
    "03": "10",  # Alicante → Comunitat Valenciana
    "04": "01",  # Almería → Andalucía
    "05": "07",  # Ávila → Castilla y León
    "06": "11",  # Badajoz → Extremadura
    "07": "04",  # Illes Balears
    "08": "09",  # Barcelona → Cataluña
    "09": "07",  # Burgos → Castilla y León
    "10": "11",  # Cáceres → Extremadura
    "11": "01",  # Cádiz → Andalucía
    "12": "10",  # Castellón → Comunitat Valenciana
    "13": "08",  # Ciudad Real → Castilla-La Mancha
    "14": "01",  # Córdoba → Andalucía
    "15": "12",  # A Coruña → Galicia
    "16": "08",  # Cuenca → Castilla-La Mancha
    "17": "09",  # Girona → Cataluña
    "18": "01",  # Granada → Andalucía
    "19": "08",  # Guadalajara → Castilla-La Mancha
    "20": "16",  # Gipuzkoa → País Vasco
    "21": "01",  # Huelva → Andalucía
    "22": "02",  # Huesca → Aragón
    "23": "01",  # Jaén → Andalucía
    "24": "07",  # León → Castilla y León
    "25": "09",  # Lleida → Cataluña
    "26": "17",  # La Rioja
    "27": "12",  # Lugo → Galicia
    "28": "13",  # Madrid
    "29": "01",  # Málaga → Andalucía
    "30": "14",  # Murcia
    "31": "15",  # Navarra
    "32": "12",  # Ourense → Galicia
    "33": "03",  # Asturias
    "34": "07",  # Palencia → Castilla y León
    "35": "05",  # Las Palmas → Canarias
    "36": "12",  # Pontevedra → Galicia
    "37": "07",  # Salamanca → Castilla y León
    "38": "05",  # S.C. Tenerife → Canarias
    "39": "06",  # Cantabria
    "40": "07",  # Segovia → Castilla y León
    "41": "01",  # Sevilla → Andalucía
    "42": "07",  # Soria → Castilla y León
    "43": "09",  # Tarragona → Cataluña
    "44": "02",  # Teruel → Aragón
    "45": "08",  # Toledo → Castilla-La Mancha
    "46": "10",  # Valencia → Comunitat Valenciana
    "47": "07",  # Valladolid → Castilla y León
    "48": "16",  # Bizkaia → País Vasco
    "49": "07",  # Zamora → Castilla y León
    "50": "02",  # Zaragoza → Aragón
    "51": "18",  # Ceuta
    "52": "19",  # Melilla
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


def province_to_ccaa_code(province_code: str | None) -> str | None:
    """Deriva CCAA desde código de provincia INE (2 dígitos)."""
    if province_code is None:
        return None
    digits = "".join(ch for ch in str(province_code).strip() if ch.isdigit())
    if len(digits) == 1:
        digits = digits.zfill(2)
    if len(digits) != 2:
        return None
    return _PROVINCE_TO_CCAA.get(digits)


def normalize_municipality_ine_code(value: str | None) -> str | None:
    """Código INE de municipio (5 dígitos).

    Acepta 5 dígitos, 4 (zfill) o códigos largos tipo Catalunya ``codi_ine10``
    (se toman los 5 primeros si la provincia es 01–52). Rechaza basura.
    """
    if value is None:
        return None
    digits = "".join(ch for ch in str(value).strip() if ch.isdigit())
    if len(digits) == 4:
        digits = digits.zfill(5)
    if len(digits) >= 5:
        code = digits[:5]
        if province_to_ccaa_code(code[:2]) is None:
            return None
        return code
    return None


def resolve_place_fields(
    *,
    nuts_code: str | None = None,
    municipality_code: str | None = None,
    ccaa_code: str | None = None,
) -> dict[str, str | None]:
    """Resuelve place_* canónicos.

    - Municipio INE válido se guarda (el upsert exige que exista en ``geo_municipio``).
    - CCAA: explícita > NUTS > provincia del municipio.
    """
    nuts = normalize_nuts_code(nuts_code)
    mun = normalize_municipality_ine_code(municipality_code)
    explicit_ccaa = (ccaa_code or "").strip() or None
    if explicit_ccaa is not None and len(explicit_ccaa) == 1:
        explicit_ccaa = explicit_ccaa.zfill(2)

    derived_nuts = nuts_to_ccaa_code(nuts)
    derived_mun = province_to_ccaa_code(mun[:2]) if mun else None
    ccaa = explicit_ccaa or derived_nuts or derived_mun

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
