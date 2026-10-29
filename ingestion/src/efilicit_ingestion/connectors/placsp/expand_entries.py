"""Expandir ZIP/Atom PLACSP a entries individuales (ADR 022).

El ZIP mensual se descarga entero; Storage solo materializa entries nuevas.
Cada entry se envuelve en un ``feed`` Atom mínimo para reutilizar
``parse_placsp_artifact`` sobre bytes no-ZIP.
"""

from __future__ import annotations

import hashlib
import zipfile
from dataclasses import dataclass
from io import BytesIO
from xml.etree.ElementTree import ParseError as XmlParseError

from lxml import etree

from efilicit_ingestion.connectors.placsp.parser import ATOM_NS, PlacspParseError
from efilicit_ingestion.models import RemoteArtifact

_FEED_NSMAP = {None: ATOM_NS}


@dataclass(frozen=True, slots=True)
class ExpandedPlacspEntry:
    """Una entry lista para RAW content-addressed + parse."""

    checksum: str
    artifact_key: str
    raw: bytes
    member_name: str
    package_artifact_key: str
    source_url: str | None


def expand_placsp_entries(
    raw: bytes,
    package: RemoteArtifact,
) -> list[ExpandedPlacspEntry]:
    """ZIP (``PK``) o Atom suelto → lista de entries con checksum estable."""
    if not raw:
        raise PlacspParseError(f"empty payload for {package.artifact_key}")

    if raw.startswith(b"PK"):
        return _expand_zip(raw, package)
    return _expand_atom_document(raw, package, member_name=package.artifact_key)


def wrap_entry_as_atom_feed(entry: etree._Element) -> bytes:
    """Documento Atom mínimo con una sola entry (parseable como Atom suelto)."""
    feed = etree.Element(f"{{{ATOM_NS}}}feed", nsmap=_FEED_NSMAP)
    feed.append(entry)
    return etree.tostring(
        feed,
        xml_declaration=True,
        encoding="UTF-8",
    )


def entry_artifact_key(checksum: str) -> str:
    return f"entries/{checksum}.atom.xml"


def _expand_zip(raw: bytes, package: RemoteArtifact) -> list[ExpandedPlacspEntry]:
    try:
        with zipfile.ZipFile(BytesIO(raw)) as zf:
            names = sorted(
                n
                for n in zf.namelist()
                if n.lower().endswith(".atom") and not n.endswith("/")
            )
            if not names:
                raise PlacspParseError(
                    f"ZIP has no .atom members: {package.artifact_key}"
                )
            out: list[ExpandedPlacspEntry] = []
            for name in names:
                out.extend(
                    _expand_atom_document(zf.read(name), package, member_name=name)
                )
            return out
    except zipfile.BadZipFile as exc:
        raise PlacspParseError(
            f"invalid ZIP artifact: {package.artifact_key}"
        ) from exc


def _expand_atom_document(
    raw: bytes,
    package: RemoteArtifact,
    *,
    member_name: str,
) -> list[ExpandedPlacspEntry]:
    try:
        root = etree.fromstring(raw)
    except etree.XMLSyntaxError as exc:
        raise PlacspParseError(
            f"invalid Atom XML in {member_name} ({package.artifact_key})"
        ) from exc
    except XmlParseError as exc:  # pragma: no cover
        raise PlacspParseError(
            f"invalid Atom XML in {member_name} ({package.artifact_key})"
        ) from exc

    tag = etree.QName(root).localname
    if tag == "entry":
        entries = [root]
    else:
        entries = root.findall(f"{{{ATOM_NS}}}entry")

    expanded: list[ExpandedPlacspEntry] = []
    for entry in entries:
        # deepcopy via serialize/parse would drop ns; clone with deepcopy of element
        entry_copy = etree.fromstring(etree.tostring(entry))
        payload = wrap_entry_as_atom_feed(entry_copy)
        checksum = hashlib.sha256(payload).hexdigest()
        expanded.append(
            ExpandedPlacspEntry(
                checksum=checksum,
                artifact_key=entry_artifact_key(checksum),
                raw=payload,
                member_name=member_name,
                package_artifact_key=package.artifact_key,
                source_url=package.source_url,
            )
        )
    return expanded
