"""Expandir página SODA a filas individuales (ADR 025).

La página JSON se descarga entera; Storage solo materializa filas nuevas
(content-addressed). Cada fila con ``id_intern`` se serializa de forma
canónica para un checksum estable entre corridas.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any

from efilicit_ingestion.connectors.socrata.errors import SocrataParseError
from efilicit_ingestion.models import RemoteArtifact

__all__ = [
    "ExpandedSocrataRow",
    "expand_socrata_rows",
    "row_artifact_key",
    "row_payload_bytes",
]


@dataclass(frozen=True, slots=True)
class ExpandedSocrataRow:
    """Una fila lista para RAW content-addressed + parse."""

    checksum: str
    artifact_key: str
    raw: bytes
    source_record_id: str
    page_artifact_key: str
    source_url: str | None


def row_artifact_key(checksum: str) -> str:
    return f"rows/{checksum}.json"


def row_payload_bytes(row: dict[str, Any]) -> bytes:
    """JSON canónico de la fila (orden de claves estable → checksum estable)."""
    return json.dumps(
        row,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")


def expand_socrata_rows(
    raw: bytes,
    page: RemoteArtifact,
) -> list[ExpandedSocrataRow]:
    """Array JSON SODA → filas con ``id_intern`` y checksum."""
    if not raw:
        raise SocrataParseError(f"empty payload for {page.artifact_key}")

    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise SocrataParseError(
            f"invalid JSON artifact: {page.artifact_key}"
        ) from exc

    if not isinstance(data, list):
        raise SocrataParseError(
            f"expected JSON array in {page.artifact_key}, got {type(data).__name__}"
        )

    out: list[ExpandedSocrataRow] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        record_id = item.get("id_intern")
        if not isinstance(record_id, str) or not record_id.strip():
            continue
        record_id = record_id.strip()
        payload = row_payload_bytes(item)
        checksum = hashlib.sha256(payload).hexdigest()
        out.append(
            ExpandedSocrataRow(
                checksum=checksum,
                artifact_key=row_artifact_key(checksum),
                raw=payload,
                source_record_id=record_id,
                page_artifact_key=page.artifact_key,
                source_url=page.source_url,
            )
        )
    return out
