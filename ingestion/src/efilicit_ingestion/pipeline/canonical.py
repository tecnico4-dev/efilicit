"""Normaliza payloads de SourceRecord hacia la forma canónica (Semana 2).

Escribe ``payload['canonical']`` con campos tipados del MVP (fechas, importes,
CPV, organismo). No toca la DB: eso es el upsert en ``canonical_repo``.

``resolve_identity`` anota confianza del organismo: NIF/CIF = HIGH; id de
plataforma = MEDIUM; solo nombre = LOW (el nombre **nunca** es identidad única).
"""

from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any
from zoneinfo import ZoneInfo

from efilicit_ingestion.models import SourceRecord
from efilicit_ingestion.pipeline.geography import (
    enrich_place_with_title_inference,
    place_from_canonical_raw,
)

# CODICE SyndicationContractFolderStatusCode 2.04 (+ DES producto / ANU alias conectores).
# Desconocido → None (no dejar el código crudo en producto).
_STATUS_MAP = {
    "PUB": "publicada",
    "PRE": "preparada",
    "ADJ": "adjudicada",
    "RES": "resuelta",
    "ANUL": "anulada",
    "ANU": "anulada",  # alias interno Catalunya/Euskadi
    "DES": "desierta",  # extensión producto (resultado); no está en la lista 2.04 de expediente
    "EV": "evaluacion",
}

# Sentinel: conservar literal si el código no está en el mapa.
_PRESERVE_UNKNOWN = object()

# CODICE ContractCode (lista oficial ContractCode-2.08).
# Desconocido → «otro» (no dejar el número crudo en producto).
_CONTRACT_TYPE_MAP = {
    "1": "suministros",
    "2": "servicios",
    "3": "obras",
    "7": "administrativo_especial",
    "8": "privado",
    "21": "gestion_servicios_publicos",
    "22": "concesion_servicios",
    "31": "concesion_obras_publicas",
    "32": "concesion_obras",
    "40": "colaboracion_publico_privada",
    "50": "patrimonial",
}

# CODICE SyndicationTenderingProcessCode 2.07 (lista oficial).
# Desconocido → «otro» (no dejar el número crudo en producto).
_PROCEDURE_MAP = {
    "1": "abierto",
    "2": "restringido",
    "3": "negociado_sin_publicidad",
    "4": "negociado_con_publicidad",
    "5": "dialogo_competitivo",
    "6": "contrato_menor",
    "7": "derivado_acuerdo_marco",
    "8": "concurso_proyectos",
    "9": "abierto_simplificado",
    "10": "asociacion_innovacion",
    "11": "derivado_asociacion_innovacion",
    "12": "sistema_dinamico_adquisicion",
    "13": "licitacion_con_negociacion",
    "100": "normas_internas",
    "999": "otro",
}


def normalize_records(records: list[SourceRecord]) -> list[SourceRecord]:
    return [normalize_record(record) for record in records]


def normalize_record(record: SourceRecord) -> SourceRecord:
    """Adjunta ``payload['canonical']`` tipado; deja el payload de fuente intacto al lado.

    Así el upsert solo lee ``canonical`` y el parser puede seguir siendo fiel al RAW.
    """
    raw = record.payload
    title = (raw.get("title") or raw.get("project_name") or "").strip()
    if not title:
        title = record.source_record_id
    title = prettify_display_title(title)

    authority_raw = raw.get("authority") or {}
    authority_name = (authority_raw.get("name") or "").strip() or "Unknown authority"

    canonical: dict[str, Any] = {
        "title": title,
        "description": raw.get("project_name"),
        "status": _map_code(raw.get("status"), _STATUS_MAP, unknown=None),
        "status_code": raw.get("status"),
        "procedure_type": _map_code(
            raw.get("procedure_type"),
            _PROCEDURE_MAP,
            unknown="otro",
        ),
        "procedure_code": raw.get("procedure_type"),
        "contract_type": _map_code(
            raw.get("contract_type"),
            _CONTRACT_TYPE_MAP,
            unknown="otro",
        ),
        "contract_type_code": raw.get("contract_type"),
        "estimated_value": _parse_amount(raw.get("estimated_value")),
        "currency": (raw.get("currency") or "EUR").strip().upper() or "EUR",
        "cpv_codes": _normalize_cpv_codes(raw.get("cpv_codes")),
        "publication_date": _publication_date(raw.get("updated_at"), record),
        "deadline_at": _parse_deadline(raw.get("deadline_at")),
        "nuts_code": _primary_code(raw.get("nuts_codes")),
        "source_tender_id": record.source_record_id,
        "source_url": raw.get("publication_url"),
        "authority": {
            "tax_id": _normalize_tax_id(authority_raw.get("tax_id")),
            "tax_id_country": "ES",
            "name": authority_name,
            "name_normalized": normalize_name(authority_name),
            "platform_id": _normalize_platform_id(authority_raw.get("platform_id")),
            # Lo rellena resolve_identity (etapa siguiente del pipeline).
            "identity_confidence": "UNRESOLVED",
        },
    }
    # Lugar de ejecución (NUTS → CCAA; municipio INE o inferido del título).
    place = place_from_canonical_raw(
        {
            "nuts_codes": raw.get("nuts_codes"),
            "nuts_code": _primary_code(raw.get("nuts_codes")),
            "municipality_ine_code": raw.get("municipality_ine_code"),
            "ccaa_code": raw.get("ccaa_code"),
        }
    )
    place = enrich_place_with_title_inference(
        place,
        title=title,
        authority_name=authority_name,
    )
    canonical.update(place)

    payload = dict(raw)
    payload["canonical"] = canonical
    return record.model_copy(update={"payload": payload})


def resolve_identity_records(records: list[SourceRecord]) -> list[SourceRecord]:
    return [resolve_identity_record(record) for record in records]


def resolve_identity_record(record: SourceRecord) -> SourceRecord:
    """Fija ``identity_confidence`` del organismo (NIF/CIF como señal primaria).

    No fusiona organismos aquí: solo anota confianza para el upsert / matching.
    """
    payload = dict(record.payload)
    canonical = dict(payload.get("canonical") or {})
    authority = dict(canonical.get("authority") or {})

    tax_id = authority.get("tax_id")
    platform_id = authority.get("platform_id")
    name = (authority.get("name") or "").strip()

    if tax_id:
        confidence = "HIGH"
    elif platform_id:
        confidence = "MEDIUM"
    elif name and name.lower() != "unknown authority":
        confidence = "LOW"
    else:
        confidence = "UNRESOLVED"

    authority["identity_confidence"] = confidence
    canonical["authority"] = authority
    payload["canonical"] = canonical
    return record.model_copy(update={"payload": payload})


def normalize_name(value: str) -> str:
    """Minúsculas, sin acentos, espacios colapsados — comparación débil, no identidad."""
    decomposed = unicodedata.normalize("NFKD", value)
    without_marks = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    collapsed = re.sub(r"\s+", " ", without_marks).strip().lower()
    return collapsed


# Partículas que en título “arreglados” quedan en minúsculas (salvo al inicio).
_TITLE_SMALL_WORDS = frozenset(
    {
        "a",
        "al",
        "con",
        "de",
        "del",
        "e",
        "el",
        "en",
        "la",
        "las",
        "los",
        "o",
        "para",
        "por",
        "sin",
        "un",
        "una",
        "unas",
        "unos",
        "y",
    }
)

# Siglas habituales en contratación (evitar tratar MADRID/SEVILLA como sigla).
_KNOWN_TITLE_ACRONYMS = frozenset(
    {
        "BOE",
        "CIF",
        "CODICE",
        "CPV",
        "DIR3",
        "DOGC",
        "EU",
        "INE",
        "IVA",
        "NIF",
        "NUTS",
        "PLACSP",
        "SA",
        "SAL",
        "SCA",
        "SL",
        "SLU",
        "SRL",
        "TED",
        "UE",
        "UTE",
    }
)


def _letter_chars(value: str) -> list[str]:
    return [ch for ch in value if ch.isalpha()]


def _is_shouty_title(title: str) -> bool:
    """Casi todo el texto en mayúsculas (títulos “en grito” de algunas fuentes)."""
    letters = _letter_chars(title)
    if len(letters) < 8:
        return False
    upper = sum(1 for ch in letters if ch.isupper())
    return (upper / len(letters)) >= 0.85


def _token_core(token: str) -> str:
    return token.strip(".,;:!?()[]{}«»\"'`")


def _looks_like_acronym(token: str) -> bool:
    """Siglas / códigos cortos en mayúsculas (CPV, SA, SLU, UTE, IVA…)."""
    core = _token_core(token)
    if not core:
        return False
    # No tratar partículas (DE, EL, PARA…) como siglas.
    if core.lower() in _TITLE_SMALL_WORDS:
        return False
    letters = _letter_chars(core)
    if len(letters) < 2:
        return False
    upper = core.upper()
    if upper in _KNOWN_TITLE_ACRONYMS:
        return True
    if any(ch.isdigit() for ch in core):
        # p. ej. CPV2008: conservar si la parte alfabética va en mayúsculas.
        return all(ch.isupper() for ch in letters) and len(letters) <= 6
    if not core.isalpha():
        return False
    # Desconocidas: solo muy cortas (2–4), no topónimos tipo MADRID.
    return core.isupper() and 2 <= len(core) <= 4


def _capitalize_word(word: str) -> str:
    """Primera letra alfabética en mayúscula; el resto en minúscula."""
    chars = list(word)
    for i, ch in enumerate(chars):
        if ch.isalpha():
            chars[i] = ch.upper()
            for j in range(i + 1, len(chars)):
                if chars[j].isalpha():
                    chars[j] = chars[j].lower()
            break
    return "".join(chars)


def _prettify_token(token: str, *, first: bool) -> str:
    if _looks_like_acronym(token):
        return token
    if "-" in _token_core(token):
        # SOFTWARE-HARDWARE → Software-Hardware (siglas por trozo).
        head, *rest = token.split("-")
        bits = [_prettify_token(head, first=first)]
        bits.extend(_prettify_token(part, first=False) for part in rest)
        return "-".join(bits)
    lower = token.lower()
    core = _token_core(lower)
    if not first and core in _TITLE_SMALL_WORDS:
        return lower
    return _capitalize_word(lower)


def prettify_display_title(title: str) -> str:
    """Arregla títulos en grito; deja intactos los que ya vienen con capitalización mixta.

    - Solo actúa si ≥85% de letras van en mayúsculas (y hay ≥8 letras).
    - Capitaliza palabras; partículas (de, del, la…) en minúsculas salvo al inicio.
    - Conserva siglas cortas en mayúsculas (CPV, SA, UTE…).
    """
    cleaned = re.sub(r"\s+", " ", title).strip()
    if not cleaned or not _is_shouty_title(cleaned):
        return cleaned
    tokens = cleaned.split(" ")
    return " ".join(
        _prettify_token(tok, first=(i == 0)) for i, tok in enumerate(tokens)
    )


def _map_code(
    value: Any,
    mapping: dict[str, str],
    *,
    unknown: Any = _PRESERVE_UNKNOWN,
) -> str | None:
    if value is None:
        return None
    code = str(value).strip()
    if not code:
        return None
    # CODICE status es mayúsculas; contratos/procedimientos son dígitos (upper no cambia).
    mapped = mapping.get(code) or mapping.get(code.upper())
    if mapped is not None:
        return mapped
    # Por defecto conservar el literal; ``unknown=None`` / ``"otro"`` evita códigos crudos.
    if unknown is _PRESERVE_UNKNOWN:
        return code
    return unknown  # type: ignore[no-any-return]


def _parse_amount(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value).strip().replace(",", "."))
    except (InvalidOperation, ValueError):
        return None


def _primary_code(values: Any) -> str | None:
    """MVP: un CPV/NUTS principal (el primero); listas completas quedan en el payload crudo."""
    if not isinstance(values, list) or not values:
        return None
    first = values[0]
    if first is None:
        return None
    text = str(first).strip()
    return text or None


def normalize_cpv_code(value: Any) -> str | None:
    """Normaliza un CPV a 8 dígitos (ceros a la derecha) + control opcional ``-X``.

    Ejemplos: ``316400`` → ``31640000``; ``31`` → ``31000000``;
    ``31640000-4`` → ``31640000-4``; ``3019.2700`` → ``30192700``.
    """
    if value is None:
        return None
    text = str(value).strip().replace(" ", "")
    if not text:
        return None

    check: str | None = None
    if "-" in text:
        base, _, suffix = text.partition("-")
        check_digits = re.sub(r"\D", "", suffix)
        if check_digits:
            check = check_digits
    else:
        base = text

    digits = re.sub(r"\D", "", base)
    if not digits:
        return None
    if len(digits) > 8:
        digits = digits[:8]
    digits = digits.ljust(8, "0")
    return f"{digits}-{check}" if check else digits


def _normalize_cpv_codes(values: Any) -> list[str]:
    """Lista única de CPV a 8 dígitos (sin dígito de control; ADR 019)."""
    if not isinstance(values, list) or not values:
        return []
    out: list[str] = []
    seen: set[str] = set()
    for value in values:
        normalized = normalize_cpv_code(value)
        if not normalized:
            continue
        code8 = normalized.split("-", 1)[0]
        if code8 not in seen:
            seen.add(code8)
            out.append(code8)
    return out


def _normalize_tax_id(value: Any) -> str | None:
    if value is None:
        return None
    cleaned = re.sub(r"[\s.-]", "", str(value)).upper()
    return cleaned or None


def _normalize_platform_id(value: Any) -> str | None:
    """Id de plataforma/DIR3: trim; sin inventar valor si viene vacío."""
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None


def _publication_date(updated_at: Any, record: SourceRecord) -> date | None:
    if record.recorded_at is not None:
        return record.recorded_at.date()
    parsed = parse_datetime_to_utc(updated_at)
    return parsed.date() if parsed else None


# Plazos/timestamptz canónicos: siempre UTC.
# Con offset → UTC; sin offset (p. ej. PLACSP EndDate+EndTime) → Europe/Madrid → UTC;
# solo fecha → 00:00 Europe/Madrid → UTC.
_MADRID = ZoneInfo("Europe/Madrid")


def _parse_deadline(value: Any) -> datetime | None:
    return parse_datetime_to_utc(value)


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=_MADRID)
    return dt.astimezone(timezone.utc)


def parse_datetime_to_utc(value: Any) -> datetime | None:
    """Normaliza ISO/datetime a UTC aware (naive = Europe/Madrid)."""
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return _as_utc(value)
    text = str(value).strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        try:
            parsed = datetime.fromisoformat(f"{text}T00:00:00")
        except ValueError:
            return None
    return _as_utc(parsed)
