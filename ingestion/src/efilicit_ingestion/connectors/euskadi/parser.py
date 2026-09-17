"""Parse Euskadi contracting-notices JSON pages into SourceRecord."""

from __future__ import annotations

import json
from collections.abc import Iterable
from typing import Any

from efilicit_ingestion.connectors.euskadi.errors import EuskadiParseError
from efilicit_ingestion.models import RemoteArtifact, SourceRecord

_STATUS = {
    "publicacion": "PUB",
    "publicación": "PUB",
    "licitacion": "PUB",
    "licitación": "PUB",
    "adjudicacion": "ADJ",
    "adjudicación": "ADJ",
    "formalizacion": "RES",
    "formalización": "RES",
    "desierto": "DES",
    "desierta": "DES",
    "anulado": "ANU",
    "anulada": "ANU",
    "cancelado": "ANU",
    "cancelada": "ANU",
}

_CONTRACT_TYPE = {
    "suministros": "1",
    "suministro": "1",
    "servicios": "2",
    "servicio": "2",
    "obras": "3",
    "obra": "3",
}


def parse_euskadi_artifact(raw: bytes, artifact: RemoteArtifact) -> Iterable[SourceRecord]:
    """Parse a KontratazioA page (``{items:[...]}``) into source records."""
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise EuskadiParseError(
            f"invalid JSON artifact: {artifact.artifact_key}"
        ) from exc

    if not isinstance(data, dict) or not isinstance(data.get("items"), list):
        raise EuskadiParseError(
            f"expected object with items[] in {artifact.artifact_key}"
        )

    for row in data["items"]:
        if not isinstance(row, dict):
            continue
        record = _map_row(row, artifact)
        if record is not None:
            yield record


def _map_row(row: dict[str, Any], artifact: RemoteArtifact) -> SourceRecord | None:
    notice_id = row.get("id")
    if notice_id is None:
        return None
    record_id = str(notice_id)

    title = _text(row.get("object")) or _text(row.get("code")) or record_id
    authority = row.get("contractingAuthority") or {}
    if not isinstance(authority, dict):
        authority = {}
    authority_name = _text(authority.get("name")) or "Unknown authority"
    tax_id = _normalize_tax(_text(authority.get("identificationNumber")))
    nuts = _text(authority.get("codNUTS"))

    status_name = _nested_name(row.get("contractProcedureStatus"))
    type_name = _nested_name(row.get("contractType"))
    procedure_name = _nested_name(row.get("contractProcedureType"))

    links = row.get("_links") if isinstance(row.get("_links"), dict) else {}
    self_link = links.get("self") if isinstance(links.get("self"), dict) else {}
    publication_url = _text(self_link.get("href"))

    budget = row.get("budgetWithoutVAT")
    estimated = str(budget) if budget is not None else None

    payload: dict[str, Any] = {
        "title": title,
        "project_name": title,
        "status": _STATUS.get(_fold(status_name or ""), None),
        "status_label": status_name,
        "procedure_type": None,
        "procedure_label": procedure_name,
        "contract_type": _CONTRACT_TYPE.get(_fold(type_name or ""), None),
        "contract_type_label": type_name,
        "estimated_value": estimated,
        "currency": "EUR",
        "cpv_codes": [],
        "nuts_codes": [nuts] if nuts else [],
        "deadline_at": None,
        "updated_at": _text(authority.get("publicationDate")),
        "publication_url": publication_url,
        "contract_folder_id": _text(row.get("code")),
        "authority": {
            "name": authority_name,
            "tax_id": tax_id,
            "platform_id": str(authority["id"]) if authority.get("id") is not None else None,
        },
        "artifact_key": artifact.artifact_key,
        "raw_row": {
            "id": notice_id,
            "code": _text(row.get("code")),
            "minor_contract": row.get("minorContract"),
        },
    }
    return SourceRecord(source_record_id=record_id, payload=payload)


def _nested_name(value: Any) -> str | None:
    if isinstance(value, dict):
        return _text(value.get("name"))
    return _text(value)


def _text(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        text = value.strip()
        return text or None
    return str(value).strip() or None


def _fold(value: str) -> str:
    lowered = value.lower()
    return lowered.translate(
        str.maketrans(
            {
                "á": "a",
                "à": "a",
                "é": "e",
                "è": "e",
                "í": "i",
                "ó": "o",
                "ò": "o",
                "ú": "u",
                "ü": "u",
            }
        )
    )


def _normalize_tax(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = value.replace(" ", "").replace("-", "").upper()
    return cleaned or None
