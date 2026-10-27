"""CODICE ContractFolderStatus → vocabulario ES canónico."""

from __future__ import annotations

from efilicit_ingestion.models import SourceRecord
from efilicit_ingestion.pipeline.canonical import normalize_record


def _record(status: str | None) -> SourceRecord:
    return SourceRecord(
        source_record_id="t-1",
        payload={
            "title": "Test",
            "status": status,
            "authority": {"name": "Org"},
            "cpv_codes": [],
            "nuts_codes": [],
        },
    )


def test_codice_status_codes_map_to_spanish_slugs() -> None:
    expected = {
        "PUB": "publicada",
        "PRE": "preparada",
        "EV": "evaluacion",
        "ADJ": "adjudicada",
        "RES": "resuelta",
        "ANUL": "anulada",
        "ANU": "anulada",
        "DES": "desierta",
        "pub": "publicada",
    }
    for code, slug in expected.items():
        canonical = normalize_record(_record(code)).payload["canonical"]
        assert canonical["status"] == slug
        assert canonical["status_code"] == code


def test_unknown_status_code_becomes_none() -> None:
    canonical = normalize_record(_record("ZZZ")).payload["canonical"]
    assert canonical["status"] is None
    assert canonical["status_code"] == "ZZZ"


def test_missing_status_stays_none() -> None:
    canonical = normalize_record(_record(None)).payload["canonical"]
    assert canonical["status"] is None
