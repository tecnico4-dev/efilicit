from __future__ import annotations

from pathlib import Path

import pytest

from efilicit_ingestion.offer_intake.placsp_terms import (
    OfferTermsParseError,
    parse_offer_terms,
)

FIXTURES = Path(__file__).parent / "fixtures" / "placsp"


def _load(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


def test_documents_map_to_pliego_types_and_downloadability() -> None:
    extract = parse_offer_terms(_load("offer_terms_entry.atom"))

    by_title = {d.title: d for d in extract.documents}
    assert by_title["PCAP alumbrado.pdf"].pliego_type == "pcap"
    assert by_title["Proyecto alumbrado.pdf"].pliego_type == "ppt"
    assert by_title["Anexo I DeclaracionResponsable.docx"].pliego_type == "anexo"
    assert by_title["Modelo de oferta económica"].pliego_type == "anexo"
    assert by_title["Memoria justificativa"].pliego_type == "otro"
    # Biblioteca wcm: tipado por nombre aunque no sea descargable.
    assert (
        by_title["Pliego de cláusulas administrativas particulares"].pliego_type
        == "pcap"
    )
    assert not by_title["Pliego de cláusulas administrativas particulares"].downloadable

    assert by_title["PCAP alumbrado.pdf"].downloadable
    assert by_title["PCAP alumbrado.pdf"].document_hash == "A6OeDcakZZXPLpktpv84c1uxq6E="
    assert not by_title["Memoria justificativa"].downloadable
    assert by_title["Memoria justificativa"].general_type_code == "9"
    assert len({d.source_key for d in extract.documents}) == len(extract.documents)


def test_lots_and_criteria_by_scope() -> None:
    extract = parse_offer_terms(_load("offer_terms_entry.atom"))

    assert [lot.lot_id for lot in extract.lots] == ["1", "2"]
    assert extract.lots[0].name == "Lote 1 · Zona norte"
    assert extract.lots[1].tax_exclusive_amount == pytest.approx(148247.93)

    root = [c for c in extract.criteria if c.lot_id is None]
    assert [(c.kind, c.weight) for c in root] == [
        ("objetivo", 60.0),
        ("objetivo", 15.0),
        ("subjetivo", 25.0),
    ]
    assert root[1].note == "1 punto por año adicional, máximo 15"

    lot_criteria = [c for c in extract.criteria if c.lot_id == "1"]
    assert [(c.description, c.weight) for c in lot_criteria] == [("Precio lote 1", 70.0)]
    assert len({c.source_key for c in extract.criteria}) == len(extract.criteria)


def test_qualifications_guarantees_and_periods() -> None:
    extract = parse_offer_terms(_load("offer_terms_entry.atom"))

    kinds = [q.kind for q in extract.qualifications]
    assert kinds.count("solvencia_tecnica") == 1
    assert kinds.count("solvencia_economica") == 1
    assert kinds.count("declaracion") == 2
    clas = next(q for q in extract.qualifications if q.kind == "clasificacion")
    assert clas.description == "Clasificación empresarial: E1-2"
    eco = next(q for q in extract.qualifications if q.kind == "solvencia_economica")
    assert eco.threshold == pytest.approx(313537.19)

    # Provisional con importe 0 se ignora; queda la definitiva al 5 %.
    assert [(g.kind, g.rate_percent) for g in extract.guarantees] == [("definitiva", 5.0)]

    assert [(e.kind, e.name) for e in extract.execution_requirements] == [
        ("social", "Consideraciones de tipo social"),
        ("medioambiental", "Consideraciones de tipo medioambiental"),
    ]
    assert extract.execution_requirements[0].description.startswith("Formación en PRL")
    assert len({e.source_key for e in extract.execution_requirements}) == 2

    assert extract.submission_deadline_at is not None
    assert extract.submission_deadline_at.isoformat() == "2026-12-09T10:00:00+01:00"
    assert extract.questions_deadline_at is not None
    assert extract.questions_deadline_at.isoformat() == "2026-12-05T14:00:00+01:00"
    assert extract.tender_opening_at is not None
    assert extract.tender_opening_at.isoformat() == "2026-12-11T12:00:00+01:00"
    assert extract.documents_available_until is not None
    assert extract.documents_available_until.isoformat() == "2026-12-07T10:00:00+01:00"


def test_entry_without_terms_yields_empty_extract() -> None:
    extract = parse_offer_terms(_load("valid_single_entry.atom"))

    assert extract.contract_folder_id == "EXP/2026/0001"
    assert extract.documents == []
    assert extract.criteria == []
    assert extract.qualifications == []
    assert extract.guarantees == []
    assert extract.submission_deadline_at is not None


def test_invalid_payload_raises() -> None:
    with pytest.raises(OfferTermsParseError):
        parse_offer_terms(b"not xml")
    with pytest.raises(OfferTermsParseError):
        parse_offer_terms(b"<feed xmlns='http://www.w3.org/2005/Atom'/>")


def test_subordinate_awarding_criteria_replace_parent() -> None:
    raw = b"""<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:cac="urn:dgpe:names:draft:codice:schema:xsd:CommonAggregateComponents-2"
      xmlns:cbc="urn:dgpe:names:draft:codice:schema:xsd:CommonBasicComponents-2"
      xmlns:cac-place-ext="urn:dgpe:names:draft:codice-place-ext:schema:xsd:CommonAggregateComponents-2">
  <entry>
    <cac-place-ext:ContractFolderStatus>
      <cbc:ContractFolderID>SUB/1</cbc:ContractFolderID>
      <cac:TenderingTerms>
        <cac:AwardingTerms>
          <cac:AwardingCriteria>
            <cbc:AwardingCriteriaTypeCode>SUBJ</cbc:AwardingCriteriaTypeCode>
            <cbc:Description>Organizacion de medios</cbc:Description>
            <cbc:WeightNumeric>20</cbc:WeightNumeric>
            <cac:SubordinateAwardingCriterion>
              <cbc:Description>1-Conocimiento</cbc:Description>
              <cbc:WeightNumeric>8</cbc:WeightNumeric>
            </cac:SubordinateAwardingCriterion>
            <cac:SubordinateAwardingCriterion>
              <cbc:Description>2-Equipos</cbc:Description>
              <cbc:WeightNumeric>12</cbc:WeightNumeric>
            </cac:SubordinateAwardingCriterion>
          </cac:AwardingCriteria>
        </cac:AwardingTerms>
      </cac:TenderingTerms>
    </cac-place-ext:ContractFolderStatus>
  </entry>
</feed>
"""
    extract = parse_offer_terms(raw)
    assert [(c.description, c.weight, c.kind) for c in extract.criteria] == [
        ("1-Conocimiento", 8.0, "subjetivo"),
        ("2-Equipos", 12.0, "subjetivo"),
    ]
