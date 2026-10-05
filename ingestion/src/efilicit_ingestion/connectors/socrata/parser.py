"""Parsea páginas JSON Socrata a SourceRecord (mapeo de campos Catalunya)."""

from __future__ import annotations

import json
from collections.abc import Iterable
from datetime import datetime
from typing import Any

from efilicit_ingestion.connectors.socrata.errors import SocrataParseError
from efilicit_ingestion.models import RemoteArtifact, SourceRecord

# fase_publicacio (catalán, normalizado) → códigos tipo CODICE para normalize.
_PHASE_STATUS = {
    "anunci de licitacio": "PUB",
    "licitacio": "PUB",
    "adjudicacio": "ADJ",
    "formalitzacio": "RES",
    "desestimacio": "DES",
    "anullacio": "ANU",
    "anulacio": "ANU",
}

_CONTRACT_TYPE = {
    "obres": "3",
    "obras": "3",
    "serveis": "2",
    "servicios": "2",
    "subministraments": "1",
    "suministros": "1",
    "concessio dobres": "3",
    "concessio de serveis": "2",
}


def parse_socrata_artifact(raw: bytes, artifact: RemoteArtifact) -> Iterable[SourceRecord]:
    """Parsea una página SODA (array JSON) en registros de fuente.

    Las filas sin ``id_intern`` estable se omiten.
    """
    try:
        text = raw.decode("utf-8")
        data = json.loads(text)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise SocrataParseError(
            f"invalid JSON artifact: {artifact.artifact_key}"
        ) from exc

    if not isinstance(data, list):
        raise SocrataParseError(
            f"expected JSON array in {artifact.artifact_key}, got {type(data).__name__}"
        )

    for row in data:
        if not isinstance(row, dict):
            continue
        record = _map_catalunya_row(row, artifact)
        if record is not None:
            yield record


def _map_catalunya_row(
    row: dict[str, Any],
    artifact: RemoteArtifact,
) -> SourceRecord | None:
    record_id = _text(row.get("id_intern"))
    if not record_id:
        return None

    title = _text(row.get("denominacio")) or _text(row.get("objecte_contracte")) or record_id
    description = _text(row.get("objecte_contracte"))
    phase = _text(row.get("fase_publicacio"))
    status = _PHASE_STATUS.get(_fold(phase or ""), None)

    estimated = (
        _text(row.get("valor_estimat_contracte"))
        or _text(row.get("pressupost_licitacio_sense"))
        or _text(row.get("valor_estimat_expedient"))
    )

    cpv = _text(row.get("codi_cpv"))
    nuts = _text(row.get("codi_nuts"))
    contract_type = _CONTRACT_TYPE.get(_fold(_text(row.get("tipus_contracte")) or ""), None)

    pub_url = _link_url(row.get("enllac_publicacio"))
    updated_at = (
        _text(row.get("data_publicacio_anunci"))
        or _text(row.get("data_publicacio_contracte"))
    )
    deadline = _text(row.get("termini_presentacio_ofertes"))

    authority_name = _text(row.get("nom_organ")) or "Unknown authority"
    platform_id = _text(row.get("codi_dir3")) or _text(row.get("codi_organ"))

    payload: dict[str, Any] = {
        "title": title,
        "project_name": description,
        "status": status,
        "fase_publicacio": phase,
        "procedure_type": None,
        "procedure_label": _text(row.get("procediment")),
        "contract_type": contract_type,
        "contract_type_label": _text(row.get("tipus_contracte")),
        "estimated_value": estimated,
        "currency": "EUR",
        "cpv_codes": [cpv] if cpv else [],
        "nuts_codes": [nuts] if nuts else [],
        "deadline_at": deadline,
        "updated_at": updated_at,
        "publication_url": pub_url,
        "contract_folder_id": _text(row.get("codi_expedient")),
        "authority": {
            "name": authority_name,
            "tax_id": None,
            "platform_id": platform_id,
        },
        "artifact_key": artifact.artifact_key,
        "raw_row": {
            "id_intern": record_id,
            "codi_expedient": _text(row.get("codi_expedient")),
            "codi_ambit": _text(row.get("codi_ambit")),
            "nom_ambit": _text(row.get("nom_ambit")),
        },
    }

    return SourceRecord(
        source_record_id=record_id,
        payload=payload,
        recorded_at=_parse_dt(updated_at),
    )


def _text(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        text = value.strip()
        return text or None
    return str(value).strip() or None


def _link_url(value: Any) -> str | None:
    if isinstance(value, dict):
        return _text(value.get("url"))
    return _text(value)


def _fold(value: str) -> str:
    lowered = value.lower().replace("·", "").replace("'", "")
    replacements = str.maketrans(
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
    return lowered.translate(replacements)


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        if value.endswith("Z"):
            value = value[:-1] + "+00:00"
        return datetime.fromisoformat(value)
    except ValueError:
        return None
