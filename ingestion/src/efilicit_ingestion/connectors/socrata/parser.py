"""Parsea páginas JSON Socrata → ``SourceRecord`` (mapeo Catalunya).

La API SODA devuelve un **array** de filas. Aquí no se escribe en DB: solo se
traducen campos catalanes a un payload neutro que ``normalize`` / upsert
entienden (mismo contrato que PLACSP/Euskadi).

Importante para matching posterior (Semana 4): este dataset **no trae NIF/CIF**
en la fila típica (``tax_id`` queda ``None``); la identidad de organismo usa
``codi_dir3`` / ``codi_organ``. Sin NIF, el auto-merge multi-fuente es más débil.
"""

from __future__ import annotations

import json
from collections.abc import Iterable
from datetime import datetime
from typing import Any

from efilicit_ingestion.connectors.socrata.errors import SocrataParseError
from efilicit_ingestion.models import RemoteArtifact, SourceRecord

# fase_publicacio (catalán, plegado) → códigos tipo CODICE para normalize.
_PHASE_STATUS = {
    "anunci de licitacio": "PUB",
    "licitacio": "PUB",
    "adjudicacio": "ADJ",
    "formalitzacio": "RES",
    "desestimacio": "DES",
    "anullacio": "ANU",
    "anulacio": "ANU",
}

# Etiquetas de tipus_contracte → códigos CODICE ContractCode 2.08.
# Tras _fold, "concessió d'obres" → "concessio dobres" (apóstrofo eliminado).
_CONTRACT_TYPE = {
    "obres": "3",
    "obras": "3",
    "serveis": "2",
    "servicios": "2",
    "subministraments": "1",
    "suministros": "1",
    # Concesiones / gestión (antes mal aplanadas a 2/3).
    "concessio de serveis": "22",
    "concesion de servicios": "22",
    "concessio dobres": "32",
    "concesion de obras": "32",
    "concessio dobres publiques": "31",
    "concesion de obras publicas": "31",
    "gestio de serveis publics": "21",
    "gestion de servicios publicos": "21",
    "collaboracio public privada": "40",
    "collaboracio public-privada": "40",
    "colaboracion publico privada": "40",
    "colaboracion publico-privada": "40",
    "colaboracion entre el sector publico y sector privado": "40",

    "administratiu especial": "7",
    "administrativo especial": "7",
    "privat": "8",
    "privado": "8",
    "patrimonial": "50",
}

# Etiquetas de procediment (CA/ES, plegadas) → SyndicationTenderingProcessCode.
_PROCEDURE_TYPE = {
    "obert": "1",
    "abierto": "1",
    "restringit": "2",
    "restringido": "2",
    "negociat sense publicitat": "3",
    "negociado sin publicidad": "3",
    "negociat amb publicitat": "4",
    "negociado con publicidad": "4",
    "negociat": "3",
    "negociado": "3",
    "dialeg competitiu": "5",
    "dialogo competitivo": "5",
    "contracte menor": "6",
    "contrato menor": "6",
    "menor": "6",
    "derivat dacord marc": "7",
    "derivat d acord marc": "7",
    "derivado de acuerdo marco": "7",
    "acord marc": "7",
    "acuerdo marco": "7",
    "concurs de projectes": "8",
    "concurso de proyectos": "8",
    "obert simplificat": "9",
    "abierto simplificado": "9",
    "associacio per a la innovacio": "10",
    "asociacion para la innovacion": "10",
    "derivat dassociacio per a la innovacio": "11",
    "derivado de asociacion para la innovacion": "11",
    "sistema dinamic dadquisicio": "12",
    "sistema dinamico de adquisicion": "12",
    "licitacio amb negociacio": "13",
    "licitacion con negociacion": "13",
    "normes internes": "100",
    "normas internas": "100",
    "altres": "999",
    "otros": "999",
    "autre": "999",
}


def parse_socrata_artifact(raw: bytes, artifact: RemoteArtifact) -> Iterable[SourceRecord]:
    """Parsea una página SODA (array JSON) en registros de fuente.

    Filas sin ``id_intern`` estable se **omiten**: sin id no hay upsert
    idempotente por ``(catalunya, source_tender_id)``.
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
    """Mapea una fila del dataset ``ybgg-dgi6`` al payload neutro del pipeline."""
    record_id = _text(row.get("id_intern"))
    if not record_id:
        return None

    title = _text(row.get("denominacio")) or _text(row.get("objecte_contracte")) or record_id
    description = _text(row.get("objecte_contracte"))
    phase = _text(row.get("fase_publicacio"))
    status = _PHASE_STATUS.get(_fold(phase or ""), None)

    # estimated_value = sin IVA: preferir presupuesto de licitación «sense».
    estimated = (
        _text(row.get("pressupost_licitacio_sense"))
        or _text(row.get("valor_estimat_contracte"))
        or _text(row.get("valor_estimat_expedient"))
    )

    cpv = _text(row.get("codi_cpv"))
    nuts = _text(row.get("codi_nuts"))
    # codi_ine10: entidad INE 10 dígitos; municipio = 5 primeros (provincia 01–52).
    municipality_ine = _text(row.get("codi_ine10"))
    contract_type = _CONTRACT_TYPE.get(_fold(_text(row.get("tipus_contracte")) or ""), None)
    procedure_label = _text(row.get("procediment"))
    procedure_type = _PROCEDURE_TYPE.get(_fold(procedure_label or ""), None)

    pub_url = _link_url(row.get("enllac_publicacio"))
    updated_at = (
        _text(row.get("data_publicacio_anunci"))
        or _text(row.get("data_publicacio_contracte"))
    )
    deadline = _text(row.get("termini_presentacio_ofertes"))

    authority_name = _text(row.get("nom_organ")) or "Unknown authority"
    # Sin NIF en SODA: platform_id (DIR3 / organ) para identidad “débil”.
    platform_id = _text(row.get("codi_dir3")) or _text(row.get("codi_organ"))

    payload: dict[str, Any] = {
        "title": title,
        "project_name": description,
        "status": status,
        "fase_publicacio": phase,
        "procedure_type": procedure_type,
        "procedure_label": procedure_label,
        "contract_type": contract_type,
        "contract_type_label": _text(row.get("tipus_contracte")),
        "estimated_value": estimated,
        "currency": "EUR",
        "cpv_codes": [cpv] if cpv else [],
        "nuts_codes": [nuts] if nuts else [],
        "municipality_ine_code": municipality_ine,
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
        # Trozo mínimo del raw para depurar sin guardar la fila entera otra vez.
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
    """SODA a veces anida el enlace como ``{url: ...}``."""
    if isinstance(value, dict):
        return _text(value.get("url"))
    return _text(value)


def _fold(value: str) -> str:
    """Normaliza etiquetas catalanas (acentos / interpunts) para lookup de mapas."""
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
