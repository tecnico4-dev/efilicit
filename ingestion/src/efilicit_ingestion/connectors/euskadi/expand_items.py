"""Expandir página KontratazioA a avisos individuales (ADR 025).

La página JSON se descarga entera; Storage solo materializa ítems nuevos
(content-addressed). Cada aviso con ``id`` se serializa de forma canónica
para un checksum estable entre corridas.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any

from efilicit_ingestion.connectors.euskadi.errors import EuskadiParseError
from efilicit_ingestion.models import RemoteArtifact

__all__ = [
    "ExpandedEuskadiItem",
    "expand_euskadi_items",
    "item_artifact_key",
    "item_payload_bytes",
]


@dataclass(frozen=True, slots=True)
class ExpandedEuskadiItem:
    """Un aviso listo para RAW content-addressed + parse."""

    checksum: str
    artifact_key: str
    raw: bytes
    source_record_id: str
    page_artifact_key: str
    source_url: str | None


def item_artifact_key(checksum: str) -> str:
    return f"rows/{checksum}.json"


def item_payload_bytes(item: dict[str, Any]) -> bytes:
    """JSON canónico del aviso (orden de claves estable → checksum estable)."""
    return json.dumps(
        item,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")


def expand_euskadi_items(
    raw: bytes,
    page: RemoteArtifact,
) -> list[ExpandedEuskadiItem]:
    """Objeto ``{items:[...]}`` → avisos con ``id`` y checksum."""
    if not raw:
        raise EuskadiParseError(f"empty payload for {page.artifact_key}")

    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise EuskadiParseError(
            f"invalid JSON artifact: {page.artifact_key}"
        ) from exc

    if not isinstance(data, dict) or not isinstance(data.get("items"), list):
        raise EuskadiParseError(
            f"expected object with items[] in {page.artifact_key}"
        )

    out: list[ExpandedEuskadiItem] = []
    for item in data["items"]:
        if not isinstance(item, dict):
            continue
        notice_id = item.get("id")
        if notice_id is None:
            continue
        record_id = str(notice_id).strip()
        if not record_id:
            continue
        payload = item_payload_bytes(item)
        checksum = hashlib.sha256(payload).hexdigest()
        out.append(
            ExpandedEuskadiItem(
                checksum=checksum,
                artifact_key=item_artifact_key(checksum),
                raw=payload,
                source_record_id=record_id,
                page_artifact_key=page.artifact_key,
                source_url=page.source_url,
            )
        )
    return out
