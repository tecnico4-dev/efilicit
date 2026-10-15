"""Normaliza payloads de SourceRecord hacia la forma canónica (Semana 2).

Escribe ``payload['canonical']`` con campos tipados del MVP (fechas, importes,
CPV, organismo). No toca la DB: eso es el upsert en ``canonical_repo``.

``resolve_identity`` anota confianza del organismo: NIF/CIF = HIGH; id de
plataforma = MEDIUM; solo nombre = LOW (el nombre **nunca** es identidad única).
"""

from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from efilicit_ingestion.models import SourceRecord
from efilicit_ingestion.pipeline.geography import place_from_canonical_raw

# Códigos CODICE / sindicación → vocabulario canónico ES (producto).
_STATUS_MAP = {
    "PUB": "publicada",
    "PRE": "preparada",
    "ADJ": "adjudicada",
    "RES": "resuelta",
    "ANU": "anulada",
    "DES": "desierta",
    "EV": "evaluacion",
}

_CONTRACT_TYPE_MAP = {
    "1": "suministros",
    "2": "servicios",
    "3": "obras",
    "8": "otro",
}

_PROCEDURE_MAP = {
    "1": "abierto",
    "2": "restringido",
    "3": "negociado",
    "4": "dialogo_competitivo",
    "5": "asociacion_innovacion",
    "6": "otro",
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

    authority_raw = raw.get("authority") or {}
    authority_name = (authority_raw.get("name") or "").strip() or "Unknown authority"

    canonical: dict[str, Any] = {
        "title": title,
        "description": raw.get("project_name"),
        "status": _map_code(raw.get("status"), _STATUS_MAP),
        "status_code": raw.get("status"),
        "procedure_type": _map_code(raw.get("procedure_type"), _PROCEDURE_MAP),
        "procedure_code": raw.get("procedure_type"),
        "contract_type": _map_code(raw.get("contract_type"), _CONTRACT_TYPE_MAP),
        "contract_type_code": raw.get("contract_type"),
        "estimated_value": _parse_amount(raw.get("estimated_value")),
        "currency": (raw.get("currency") or "EUR").strip().upper() or "EUR",
        "cpv_code": _primary_code(raw.get("cpv_codes")),
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
    # Lugar de ejecución (NUTS → CCAA; municipio INE solo si la fuente lo aporta).
    place = place_from_canonical_raw(
        {
            "nuts_codes": raw.get("nuts_codes"),
            "nuts_code": _primary_code(raw.get("nuts_codes")),
            "municipality_ine_code": raw.get("municipality_ine_code"),
            "ccaa_code": raw.get("ccaa_code"),
        }
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


def _map_code(value: Any, mapping: dict[str, str]) -> str | None:
    if value is None:
        return None
    code = str(value).strip()
    if not code:
        return None
    # Código desconocido: conservar el literal (mejor que perder la señal).
    return mapping.get(code, code)


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
    parsed = _parse_datetime(updated_at)
    return parsed.date() if parsed else None


def _parse_deadline(value: Any) -> datetime | None:
    return _parse_datetime(value)


def _parse_datetime(value: Any) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value
    text = str(value).strip().replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        # Solo fecha (sin hora)
        try:
            return datetime.fromisoformat(f"{text}T00:00:00")
        except ValueError:
            return None
