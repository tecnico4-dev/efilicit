"""prettify_display_title: solo títulos en grito; conserva siglas y capitalización mixta."""

from __future__ import annotations

from efilicit_ingestion.models import SourceRecord
from efilicit_ingestion.pipeline.canonical import (
    normalize_record,
    prettify_display_title,
)


def test_leaves_mixed_case_untouched() -> None:
    title = "Suministro de material de oficina para el Ayuntamiento"
    assert prettify_display_title(title) == title


def test_shouty_title_becomes_title_case() -> None:
    got = prettify_display_title(
        "SUMINISTRO DE SOFTWARE PARA EL AYUNTAMIENTO DE MADRID"
    )
    assert got == "Suministro de Software para el Ayuntamiento de Madrid"


def test_preserves_short_acronyms() -> None:
    got = prettify_display_title("CONTRATO DE SERVICIOS CPV Y UTE CON SA")
    assert got == "Contrato de Servicios CPV y UTE con SA"


def test_short_or_mostly_lower_not_touched() -> None:
    assert prettify_display_title("OBRAS") == "OBRAS"  # < 8 letras
    assert prettify_display_title("suministro de software") == "suministro de software"


def test_normalize_record_applies_prettify() -> None:
    record = SourceRecord(
        source_record_id="x:1",
        payload={
            "title": "MANTENIMIENTO DE EQUIPOS INFORMATICOS CPV",
            "authority": {"name": "Org", "tax_id": "B00000000"},
            "cpv_codes": [],
            "nuts_codes": [],
        },
    )
    canonical = normalize_record(record).payload["canonical"]
    assert canonical["title"] == "Mantenimiento de Equipos Informaticos CPV"
