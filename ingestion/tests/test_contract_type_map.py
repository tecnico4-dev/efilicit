"""CODICE ContractCode → vocabulario ES canónico."""

from __future__ import annotations

from efilicit_ingestion.models import SourceRecord
from efilicit_ingestion.pipeline.canonical import normalize_record


def _record(contract_type: str | None) -> SourceRecord:
    return SourceRecord(
        source_record_id="t-1",
        payload={
            "title": "Test",
            "contract_type": contract_type,
            "authority": {"name": "Org"},
            "cpv_codes": [],
            "nuts_codes": [],
        },
    )


def test_codice_contract_codes_map_to_spanish_slugs() -> None:
    expected = {
        "1": "suministros",
        "2": "servicios",
        "3": "obras",
        "7": "administrativo_especial",
        "8": "privado",
        "21": "gestion_servicios_publicos",
        "22": "concesion_servicios",
        "31": "concesion_obras_publicas",
        "32": "concesion_obras",
        "40": "colaboracion_publico_privada",
        "50": "patrimonial",
    }
    for code, slug in expected.items():
        canonical = normalize_record(_record(code)).payload["canonical"]
        assert canonical["contract_type"] == slug
        assert canonical["contract_type_code"] == code


def test_unknown_contract_type_code_becomes_otro() -> None:
    canonical = normalize_record(_record("99")).payload["canonical"]
    assert canonical["contract_type"] == "otro"
    assert canonical["contract_type_code"] == "99"


def test_missing_contract_type_stays_none() -> None:
    canonical = normalize_record(_record(None)).payload["canonical"]
    assert canonical["contract_type"] is None
