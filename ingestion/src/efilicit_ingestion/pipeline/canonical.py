"""Normalize SourceRecord payloads toward the canonical tender shape (Semana 2)."""

from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from efilicit_ingestion.models import SourceRecord

# PLACSP / CODICE syndication codes → stable labels for the MVP canonical model.
_STATUS_MAP = {
    "PUB": "published",
    "PRE": "prepared",
    "ADJ": "awarded",
    "RES": "resolved",
    "ANU": "cancelled",
    "DES": "deserted",
    "EV": "evaluation",
}

_CONTRACT_TYPE_MAP = {
    "1": "supplies",
    "2": "services",
    "3": "works",
    "8": "other",
}

_PROCEDURE_MAP = {
    "1": "open",
    "2": "restricted",
    "3": "negotiated",
    "4": "competitive_dialogue",
    "5": "innovation_partnership",
    "6": "other",
}


def normalize_records(records: list[SourceRecord]) -> list[SourceRecord]:
    return [normalize_record(record) for record in records]


def normalize_record(record: SourceRecord) -> SourceRecord:
    """Attach ``payload['canonical']`` with typed/normalized MVP fields."""
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
            "platform_id": authority_raw.get("platform_id"),
            # Filled by resolve_identity.
            "identity_confidence": "UNRESOLVED",
        },
    }

    payload = dict(raw)
    payload["canonical"] = canonical
    return record.model_copy(update={"payload": payload})


def resolve_identity_records(records: list[SourceRecord]) -> list[SourceRecord]:
    return [resolve_identity_record(record) for record in records]


def resolve_identity_record(record: SourceRecord) -> SourceRecord:
    """Set authority ``identity_confidence`` using fiscal id as primary signal."""
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
    """Lowercase, strip accents, collapse whitespace — not used as unique identity."""
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
    return mapping.get(code, code)


def _parse_amount(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value).strip().replace(",", "."))
    except (InvalidOperation, ValueError):
        return None


def _primary_code(values: Any) -> str | None:
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
        # Date-only
        try:
            return datetime.fromisoformat(f"{text}T00:00:00")
        except ValueError:
            return None
