"""Parser Atom/CODICE de PLACSP (Semana 2 Paso 5).

Produce ``SourceRecord`` con nombres de campo neutros para normalize/upsert.
No escribe en la DB canónica. La identidad estable está documentada en
``docs/sources/placsp.md`` (``tax_id|platform_id:ContractFolderID``).
"""

from __future__ import annotations

import zipfile
from datetime import datetime
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

NS = {
    "atom": ATOM_NS,
    "cbc": CBC_NS,
    "cac": CAC_NS,
    "cac_ext": CAC_EXT_NS,
}


class PlacspParseError(Exception):
    """Fallo de parseo irrecuperable de un artefacto PLACSP."""


def parse_placsp_artifact(
    raw: bytes,
    artifact: RemoteArtifact,
) -> Iterable[SourceRecord]:
    """Parsea ZIP (preferido) o bytes ``.atom`` sueltos en registros de fuente."""
    if not raw:
        raise PlacspParseError(f"empty payload for {artifact.artifact_key}")

    if raw.startswith(b"PK"):
        yield from _parse_zip(raw, artifact)
        return

    yield from _parse_atom_document(raw, artifact, member_name=artifact.artifact_key)


def _parse_zip(raw: bytes, artifact: RemoteArtifact) -> Iterable[SourceRecord]:
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

    # Aceptar raíz feed o un documento con una sola entry.
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
        # Forma inesperada: omitir la entry en lugar de inventar identidad.
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
        payload["status"] = _text(status_node.find("cbc:ContractFolderStatusCode", NS))
        payload["authority"] = _extract_authority(status_node)
        payload.update(_extract_project_fields(status_node))

    recorded_at = _parse_atom_datetime(updated)
    return SourceRecord(
        source_record_id=source_record_id,
        payload=payload,
        recorded_at=recorded_at,
    )


def _stable_source_record_id(
    *,
    folder_id: str | None,
    authority: dict[str, Any],
    atom_id: str | None,
) -> str | None:
    """Id estable para upsert: preferir alcance de organismo + ContractFolderID.

    Documentado en docs/sources/placsp.md:
    ``{tax_id|platform_id}:{ContractFolderID}`` si se puede; si no, folder id;
    si no, atom:id como último recurso.
    """
    if folder_id:
        party = authority.get("tax_id") or authority.get("platform_id")
        if party:
            return f"{party}:{folder_id}"
        return folder_id
    return atom_id


def _extract_authority(status_node: etree._Element) -> dict[str, Any]:
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
        # Some feeds put NIF without a helpful scheme; take first ID-looking token.
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

    # Prefer Name as object/title complement when entry title is empty.
    project_name = _text(project.find("cbc:Name", NS))
    if project_name:
        out["project_name"] = project_name

    out["contract_type"] = _text(project.find("cbc:TypeCode", NS))

    amount = project.find("cac:BudgetAmount/cbc:TotalAmount", NS)
    if amount is None:
        amount = project.find("cac:BudgetAmount/cbc:TaxExclusiveAmount", NS)
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
        # Support trailing Z.
        normalized = value.replace("Z", "+00:00")
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None
