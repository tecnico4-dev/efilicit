"""CODICE SyndicationTenderingProcessCode → vocabulario ES canónico."""

from __future__ import annotations

from efilicit_ingestion.models import SourceRecord
from efilicit_ingestion.pipeline.canonical import normalize_record


def _record(procedure_type: str | None) -> SourceRecord:
    return SourceRecord(
        source_record_id="t-1",
        payload={
            "title": "Test",
            "procedure_type": procedure_type,
            "authority": {"name": "Org"},
            "cpv_codes": [],
            "nuts_codes": [],
        },
    )


def test_codice_procedure_codes_map_to_spanish_slugs() -> None:
    expected = {
        "1": "abierto",
        "2": "restringido",
        "3": "negociado_sin_publicidad",
        "4": "negociado_con_publicidad",
        "5": "dialogo_competitivo",
        "6": "contrato_menor",
        "7": "derivado_acuerdo_marco",
        "8": "concurso_proyectos",
        "9": "abierto_simplificado",
        "10": "asociacion_innovacion",
        "11": "derivado_asociacion_innovacion",
        "12": "sistema_dinamico_adquisicion",
        "13": "licitacion_con_negociacion",
        "100": "normas_internas",
        "999": "otro",
    }
    for code, slug in expected.items():
        canonical = normalize_record(_record(code)).payload["canonical"]
        assert canonical["procedure_type"] == slug
        assert canonical["procedure_code"] == code


def test_unknown_procedure_type_code_becomes_otro() -> None:
    canonical = normalize_record(_record("42")).payload["canonical"]
    assert canonical["procedure_type"] == "otro"
    assert canonical["procedure_code"] == "42"


def test_missing_procedure_type_stays_none() -> None:
    canonical = normalize_record(_record(None)).payload["canonical"]
    assert canonical["procedure_type"] is None
