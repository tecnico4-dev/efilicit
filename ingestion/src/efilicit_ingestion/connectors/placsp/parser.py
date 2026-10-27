"""Parser Atom/CODICE de PLACSP (Semana 2 Paso 5).

El ZIP mensual contiene uno o más ``.atom``. Cada ``atom:entry`` lleva un
bloque CODICE (``ContractFolderStatus``). Aquí **no** se escribe en DB: solo
se produce ``SourceRecord`` con payload neutro para normalize/upsert.

Identidad estable (docs/sources/placsp.md):
``{tax_id|platform_id}:{ContractFolderID}`` cuando hay organismo + carpeta;
si no, folder id; último recurso ``atom:id``. Sin id usable → se omite la entry
(mejor perder una fila que inventar claves que rompan el unique).

Si el mismo expediente aparece varias veces en el ZIP/Atom (versiones),
se conserva solo la entry con ``atom:updated`` más reciente.
"""

from __future__ import annotations

import re
import zipfile
from datetime import datetime, timezone
from io import BytesIO
from typing import Any, Iterable
from xml.etree.ElementTree import ParseError as XmlParseError

from lxml import etree

from efilicit_ingestion.models import RemoteArtifact, SourceRecord

ATOM_NS = "http://www.w3.org/2005/Atom"
CBC_NS = "urn:dgpe:names:draft:codice:schema:xsd:CommonBasicComponents-2"
CAC_NS = "urn:dgpe:names:draft:codice:schema:xsd:CommonAggregateComponents-2"
CAC_EXT_NS = (
    "urn:dgpe:names:draft:codice-place-ext:schema:xsd:CommonAggregateComponents-2"
)
# Estado del expediente: cbc-place-ext:ContractFolderStatusCode (XSD PLACE-EXT 1.4).
CBC_PLACE_EXT_NS = (
    "urn:dgpe:names:draft:codice-place-ext:schema:xsd:CommonBasicComponents-2"
)

NS = {
    "atom": ATOM_NS,
    "cbc": CBC_NS,
    "cac": CAC_NS,
    "cac_ext": CAC_EXT_NS,
    "cbc_place_ext": CBC_PLACE_EXT_NS,
}

# Resumen Atom: «…; Estado: PUB» cuando el bloque CODICE no trae el código.
_TITLE_STATUS_RE = re.compile(
    r"Estado:\s*(PUB|PRE|EV|ADJ|RES|ANUL)\b",
    re.IGNORECASE,
)


class PlacspParseError(Exception):
    """Fallo de parseo irrecuperable (ZIP/XML inválido) — aborta el artefacto."""


def parse_placsp_artifact(
    raw: bytes,
    artifact: RemoteArtifact,
) -> Iterable[SourceRecord]:
    """Parsea ZIP (preferido en prod) o bytes ``.atom`` sueltos (fixtures).

    Firma ``PK`` → ZIP; si no, se trata como un documento Atom único.
    Varias entries con el mismo ``source_record_id`` → gana ``atom:updated``
    más reciente (no el orden del ZIP/XML).
    """
    if not raw:
        raise PlacspParseError(f"empty payload for {artifact.artifact_key}")

    if raw.startswith(b"PK"):
        records = list(_parse_zip(raw, artifact))
    else:
        records = list(
            _parse_atom_document(raw, artifact, member_name=artifact.artifact_key)
        )
    yield from _keep_newest_by_source_record_id(records)


def _keep_newest_by_source_record_id(
    records: list[SourceRecord],
) -> list[SourceRecord]:
    """Una fila por identidad: la de ``recorded_at`` (atom:updated) más nueva."""
    best: dict[str, tuple[SourceRecord, int]] = {}
    for index, record in enumerate(records):
        prev = best.get(record.source_record_id)
        if prev is None or _is_newer_version(record, index, prev[0], prev[1]):
            best[record.source_record_id] = (record, index)
    # Orden estable: primera aparición de cada identidad en el artefacto.
    ordered = sorted(best.values(), key=lambda item: item[1])
    return [record for record, _index in ordered]


def _is_newer_version(
    candidate: SourceRecord,
    candidate_index: int,
    incumbent: SourceRecord,
    incumbent_index: int,
) -> bool:
    cand_ts = _as_utc_naive(candidate.recorded_at)
    inc_ts = _as_utc_naive(incumbent.recorded_at)
    if cand_ts is not None and inc_ts is not None:
        if cand_ts != inc_ts:
            return cand_ts > inc_ts
    elif cand_ts is not None:
        return True
    elif inc_ts is not None:
        return False
    # Empate / sin fecha: gana la que aparece después en el artefacto.
    return candidate_index > incumbent_index


def _as_utc_naive(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def _parse_zip(raw: bytes, artifact: RemoteArtifact) -> Iterable[SourceRecord]:
    """Abre el ZIP y parsea cada miembro ``.atom`` (orden estable por nombre)."""
    try:
        with zipfile.ZipFile(BytesIO(raw)) as zf:
            names = sorted(
                n for n in zf.namelist() if n.lower().endswith(".atom") and not n.endswith("/")
            )
            if not names:
                raise PlacspParseError(
                    f"ZIP has no .atom members: {artifact.artifact_key}"
                )
            for name in names:
                yield from _parse_atom_document(
                    zf.read(name),
                    artifact,
                    member_name=name,
                )
    except zipfile.BadZipFile as exc:
        raise PlacspParseError(
            f"invalid ZIP artifact: {artifact.artifact_key}"
        ) from exc


def _parse_atom_document(
    raw: bytes,
    artifact: RemoteArtifact,
    *,
    member_name: str,
) -> Iterable[SourceRecord]:
    """Una raíz ``feed`` (varias entries) o un documento con una sola ``entry``."""
    try:
        root = etree.fromstring(raw)
    except etree.XMLSyntaxError as exc:
        raise PlacspParseError(
            f"invalid Atom XML in {member_name} ({artifact.artifact_key})"
        ) from exc
    except XmlParseError as exc:  # pragma: no cover - lxml usually raises XMLSyntaxError
        raise PlacspParseError(
            f"invalid Atom XML in {member_name} ({artifact.artifact_key})"
        ) from exc

    tag = etree.QName(root).localname
    if tag == "entry":
        entries = [root]
    else:
        entries = root.findall("atom:entry", NS)

    for entry in entries:
        record = _entry_to_source_record(entry, artifact, member_name=member_name)
        if record is not None:
            yield record


def _entry_to_source_record(
    entry: etree._Element,
    artifact: RemoteArtifact,
    *,
    member_name: str,
) -> SourceRecord | None:
    """Mapea una entry Atom+CODICE a payload neutro; None si no hay id estable."""
    atom_id = _text(entry.find("atom:id", NS))
    title = _text(entry.find("atom:title", NS))
    updated = _text(entry.find("atom:updated", NS))
    link = entry.find("atom:link", NS)
    publication_url = link.get("href") if link is not None else None

    status_node = entry.find(".//cac_ext:ContractFolderStatus", NS)
    folder_id = _text(status_node.find("cbc:ContractFolderID", NS)) if status_node is not None else None

    source_record_id = _stable_source_record_id(
        folder_id=folder_id,
        authority=_extract_authority(status_node) if status_node is not None else {},
        atom_id=atom_id,
    )
    if source_record_id is None:
        # Forma inesperada: omitir en lugar de inventar identidad (rompe upsert).
        return None

    payload: dict[str, Any] = {
        "title": title,
        "status": None,
        "contract_folder_id": folder_id,
        "publication_url": publication_url,
        "updated_at": updated,
        "estimated_value": None,
        "currency": None,
        "cpv_codes": [],
        "contract_type": None,
        "procedure_type": None,
        "deadline_at": None,
        "authority": {},
        "nuts_codes": [],
        "atom_id": atom_id,
        "atom_member": member_name,
        "artifact_key": artifact.artifact_key,
    }

    if status_node is not None:
        payload["status"] = _extract_folder_status_code(status_node, title=title)
        payload["authority"] = _extract_authority(status_node)
        payload.update(_extract_project_fields(status_node))
    elif title:
        # Sin bloque CODICE: último recurso el resumen Atom («Estado: PUB»).
        payload["status"] = _status_from_atom_title(title)

    recorded_at = _parse_atom_datetime(updated)
    return SourceRecord(
        source_record_id=source_record_id,
        payload=payload,
        recorded_at=recorded_at,
    )


def _extract_folder_status_code(
    status_node: etree._Element,
    *,
    title: str | None,
) -> str | None:
    """Lee ContractFolderStatusCode (place-ext real; cbc en fixtures; local-name)."""
    node = status_node.find("cbc_place_ext:ContractFolderStatusCode", NS)
    if node is None:
        node = status_node.find("cbc:ContractFolderStatusCode", NS)
    if node is None:
        # Prefijo/URI distintos entre paquetes: local-name (ignora comentarios XML).
        for child in status_node.xpath("./*[local-name()='ContractFolderStatusCode']"):
            node = child
            break
    code = _text(node)
    if code:
        return code.upper()
    return _status_from_atom_title(title)


def _status_from_atom_title(title: str | None) -> str | None:
    if not title:
        return None
    match = _TITLE_STATUS_RE.search(title)
    return match.group(1).upper() if match else None


def _stable_source_record_id(
    *,
    folder_id: str | None,
    authority: dict[str, Any],
    atom_id: str | None,
) -> str | None:
    """Id estable para upsert: organismo + ContractFolderID cuando sea posible.

    Preferir NIF/CIF (``tax_id``) sobre id de plataforma. El unique canónico es
    ``(source_code, source_tender_id)``; este string es el ``source_tender_id``.
    """
    if folder_id:
        party = authority.get("tax_id") or authority.get("platform_id")
        if party:
            return f"{party}:{folder_id}"
        return folder_id
    return atom_id


def _extract_authority(status_node: etree._Element) -> dict[str, Any]:
    """Organismo contratante: nombre + NIF/CIF si el scheme lo indica."""
    party = status_node.find("cac_ext:LocatedContractingParty", NS)
    if party is None:
        party = status_node.find(".//cac_ext:LocatedContractingParty", NS)
    if party is None:
        return {}

    name = _text(party.find(".//cac:PartyName/cbc:Name", NS))
    tax_id = None
    platform_id = None
    for pid in party.findall(".//cac:PartyIdentification/cbc:ID", NS):
        scheme = (pid.get("schemeName") or pid.get("schemeAgencyID") or "").lower()
        value = _text(pid)
        if not value:
            continue
        if "nif" in scheme or "cif" in scheme or "vat" in scheme:
            tax_id = value
        elif platform_id is None:
            platform_id = value
    if tax_id is None:
        # Algunos feeds meten el NIF sin scheme útil: heurística solo si “parece” NIF.
        first = _text(party.find(".//cac:PartyIdentification/cbc:ID", NS))
        if first and _looks_like_tax_id(first):
            tax_id = first
        elif first and platform_id is None:
            platform_id = first

    return {
        "name": name,
        "tax_id": tax_id,
        "platform_id": platform_id,
    }


def _extract_project_fields(status_node: etree._Element) -> dict[str, Any]:
    """Importe, CPV, tipo, procedimiento y plazo desde ``ProcurementProject`` / process."""
    project = status_node.find("cac:ProcurementProject", NS)
    if project is None:
        project = status_node.find(".//cac:ProcurementProject", NS)

    out: dict[str, Any] = {
        "estimated_value": None,
        "currency": None,
        "cpv_codes": [],
        "contract_type": None,
        "procedure_type": None,
        "deadline_at": None,
        "nuts_codes": [],
    }
    if project is None:
        return out

    # Complemento de título cuando atom:title viene vacío.
    project_name = _text(project.find("cbc:Name", NS))
    if project_name:
        out["project_name"] = project_name

    out["contract_type"] = _text(project.find("cbc:TypeCode", NS))

    # estimated_value = sin IVA: preferir TaxExclusiveAmount; TotalAmount solo si falta.
    amount = project.find("cac:BudgetAmount/cbc:TaxExclusiveAmount", NS)
    if amount is None:
        amount = project.find("cac:BudgetAmount/cbc:TotalAmount", NS)
    if amount is not None:
        out["estimated_value"] = _text(amount)
        out["currency"] = amount.get("currencyID")

    cpvs: list[str] = []
    for cpv in project.findall(
        ".//cac:RequiredCommodityClassification/cbc:ItemClassificationCode",
        NS,
    ):
        code = _text(cpv)
        if code:
            cpvs.append(code)
    out["cpv_codes"] = cpvs

    nuts: list[str] = []
    for nut in project.findall(
        ".//cac:RealizedLocation/cbc:CountrySubentityCode",
        NS,
    ):
        code = _text(nut)
        if code:
            nuts.append(code)
    out["nuts_codes"] = nuts

    process = status_node.find("cac:TenderingProcess", NS)
    if process is None:
        process = status_node.find(".//cac:TenderingProcess", NS)
    if process is not None:
        out["procedure_type"] = _text(process.find("cbc:ProcedureCode", NS))
        deadline = _text(
            process.find("cac:TenderSubmissionDeadlinePeriod/cbc:EndDate", NS)
        )
        end_time = _text(
            process.find("cac:TenderSubmissionDeadlinePeriod/cbc:EndTime", NS)
        )
        if deadline and end_time:
            out["deadline_at"] = f"{deadline}T{end_time}"
        elif deadline:
            out["deadline_at"] = deadline

    return out


def _looks_like_tax_id(value: str) -> bool:
    """Heurística mínima ES: mezcla letras/dígitos y longitud típica de NIF/CIF."""
    cleaned = value.replace("-", "").replace(" ", "").upper()
    if len(cleaned) < 8 or len(cleaned) > 12:
        return False
    return any(ch.isdigit() for ch in cleaned) and any(
        ch.isalpha() for ch in cleaned
    )


def _text(node: etree._Element | None) -> str | None:
    if node is None:
        return None
    value = (node.text or "").strip()
    return value or None


def _parse_atom_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        # Atom suele traer Z (UTC); fromisoformat prefiere offset explícito.
        normalized = value.replace("Z", "+00:00")
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None
