"""Parsea páginas JSON ``contracting-notices`` → ``SourceRecord``.

Shape de la API: objeto con ``items[]`` (no array raíz como SODA). Mapeamos a
payload neutro para normalize/upsert. Suele incluir NIF
(``identificationNumber``) → ``authority.tax_id`` usable en matching Semana 4.
"""

from __future__ import annotations

import json
from collections.abc import Iterable
from typing import Any

from efilicit_ingestion.connectors.euskadi.errors import EuskadiParseError
from efilicit_ingestion.models import RemoteArtifact, SourceRecord

# Etiquetas de estado API → códigos tipo CODICE (normalize del pipeline).
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

# contractType.name (ES, plegado) → CODICE ContractCode 2.08.
_CONTRACT_TYPE = {
    "suministros": "1",
    "suministro": "1",
    "servicios": "2",
    "servicio": "2",
    "obras": "3",
    "obra": "3",
    "concesion de servicios": "22",
    "concesion servicios": "22",
    "concesion de obras": "32",
    "concesion obras": "32",
    "concesion de obras publicas": "31",
    "concesion obras publicas": "31",
    "gestion de servicios publicos": "21",
    "gestion servicios publicos": "21",
    "colaboracion publico privada": "40",
    "colaboracion publico-privada": "40",
    "colaboracion entre el sector publico y sector privado": "40",
    "administrativo especial": "7",
    "privado": "8",
    "patrimonial": "50",
}

# Si la API trae id CODICE en contractType.id, preferirlo al nombre.
_CONTRACT_TYPE_IDS = frozenset(_CONTRACT_TYPE.values())

# Etiquetas de contractProcedureType (ES, plegadas) → SyndicationTenderingProcessCode.
_PROCEDURE_TYPE = {
    "abierto": "1",
    "restringido": "2",
    "negociado sin publicidad": "3",
    "negociado con publicidad": "4",
    "negociado": "3",
    "dialogo competitivo": "5",
    "contrato menor": "6",
    "menor": "6",
    "derivado de acuerdo marco": "7",
    "acuerdo marco": "7",
    "concurso de proyectos": "8",
    "abierto simplificado": "9",
    "asociacion para la innovacion": "10",
    "derivado de asociacion para la innovacion": "11",
    "sistema dinamico de adquisicion": "12",
    "licitacion con negociacion": "13",
    "normas internas": "100",
    "otros": "999",
    "otro": "999",
}


def parse_euskadi_artifact(raw: bytes, artifact: RemoteArtifact) -> Iterable[SourceRecord]:
    """Parsea una página KontratazioA (``{items:[...]}``) en registros de fuente.

    Ítems sin ``id`` se omiten: el unique canónico es ``(euskadi, id)``.
    """
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
    """Mapea un aviso de ``items[]`` al payload neutro del pipeline."""
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

    # Muchos campos vienen como {id, name}; nos quedamos con el name legible.
    status_name = _nested_name(row.get("contractProcedureStatus"))
    type_name = _nested_name(row.get("contractType"))
    procedure_name = _nested_name(row.get("contractProcedureType"))
    procedure_type = _PROCEDURE_TYPE.get(_fold(procedure_name or ""), None)
    contract_type = _contract_type_code(row.get("contractType"), type_name)

    links = row.get("_links") if isinstance(row.get("_links"), dict) else {}
    self_link = links.get("self") if isinstance(links.get("self"), dict) else {}
    publication_url = _text(self_link.get("href"))

    budget = row.get("budgetWithoutVAT")
    estimated = str(budget) if budget is not None else None
    # Plazo de presentación: ``deadlineDate`` en /contracting-notices.
    # CPV de la licitación no viene en este endpoint (sí en /contracts); no mapear
    # ``contractingAuthority.CPV`` (actividad del órgano, no del objeto).
    deadline = _text(row.get("deadlineDate"))

    payload: dict[str, Any] = {
        "title": title,
        "project_name": title,
        "status": _STATUS.get(_fold(status_name or ""), None),
        "status_label": status_name,
        "procedure_type": procedure_type,
        "procedure_label": procedure_name,
        "contract_type": contract_type,
        "contract_type_label": type_name,
        "estimated_value": estimated,
        "currency": "EUR",
        "cpv_codes": [],
        "nuts_codes": [nuts] if nuts else [],
        "deadline_at": deadline,
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


def _contract_type_code(raw: Any, type_name: str | None) -> str | None:
    """Prefiere ``contractType.id`` si es un código CODICE conocido; si no, el nombre."""
    if isinstance(raw, dict) and raw.get("id") is not None:
        code = str(raw["id"]).strip()
        if code in _CONTRACT_TYPE_IDS:
            return code
    if type_name:
        return _CONTRACT_TYPE.get(_fold(type_name), None)
    return None


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
    """Quita acentos / puntuación ligera para matchear claves de mapas."""
    lowered = value.lower().replace("·", "").replace("'", "")
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
    """NIF/CIF sin espacios ni guiones, mayúsculas — comparación estable en matching."""
    if not value:
        return None
    cleaned = value.replace(" ", "").replace("-", "").upper()
    return cleaned or None
