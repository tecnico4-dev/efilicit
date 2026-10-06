"""Semana 4 Paso 5: cross-source matching (annotate only; no merge)."""

from __future__ import annotations

from decimal import Decimal

from efilicit_ingestion.models import SourceRecord
from efilicit_ingestion.pipeline import stages
from efilicit_ingestion.pipeline.canonical_repo import InMemoryCanonicalRepository
from efilicit_ingestion.pipeline.matching import (
    METHOD_EXPEDIENTE_TAX_ID,
    METHOD_TAX_ID_SIGNALS,
    METHOD_TITLE_SIMILARITY,
    REVIEW_AUTO,
    REVIEW_PENDING,
    REVIEW_UNMATCHED,
    match_records,
)


def _record(
    *,
    source_record_id: str,
    title: str,
    tax_id: str | None,
    expediente: str | None,
    cpv_code: str | None = "30192700",
    estimated_value: str | Decimal | None = "1000.00",
    publication_date: str | None = "2024-06-01",
) -> SourceRecord:
    source_tender_id = (
        f"{tax_id}:{expediente}" if tax_id and expediente else source_record_id
    )
    payload: dict = {
        "contract_folder_id": expediente,
        "canonical": {
            "source_tender_id": source_tender_id,
            "title": title,
            "cpv_code": cpv_code,
            "estimated_value": (
                Decimal(str(estimated_value)) if estimated_value is not None else None
            ),
            "publication_date": publication_date,
            "status": "published",
            "authority": {
                "tax_id": tax_id,
                "name": "Ayuntamiento de Prueba",
                "country_code": "ES",
            },
        },
    }
    return SourceRecord(source_record_id=source_record_id, payload=payload)


def test_match_auto_on_expediente_and_tax_id() -> None:
    repo = InMemoryCanonicalRepository()
    existing = _record(
        source_record_id="placsp-1",
        title="Suministro de material de oficina",
        tax_id="P2800000A",
        expediente="EXP-2024-100",
    )
    repo.upsert_records(source_code="placsp", records=[existing])
    tender_id = next(iter(repo.tenders))

    incoming = _record(
        source_record_id="cat-1",
        title="Suministro de material de oficina (lote 1)",
        tax_id="P2800000A",
        expediente="EXP-2024-100",
    )
    matched = match_records(
        [incoming], source_code="catalunya", lookup=repo
    )
    decision = matched[0].payload["match"]
    assert decision["review_status"] == REVIEW_AUTO
    assert decision["match_method"] == METHOD_EXPEDIENTE_TAX_ID
    assert decision["matched_tender_id"] == tender_id
    assert decision["match_score"] == 1.0


def test_match_pending_when_same_nif_but_conflicting_expediente() -> None:
    """NIF + señales blandas no hacen auto si ambas carpetas existen y difieren."""
    repo = InMemoryCanonicalRepository()
    repo.upsert_records(
        source_code="placsp",
        records=[
            _record(
                source_record_id="p1",
                title="Suministro de material de oficina 2025",
                tax_id="P2800000A",
                expediente="EXP-2025-10",
                cpv_code="30192700",
                estimated_value="1000.00",
                publication_date="2025-03-01",
            )
        ],
    )
    prior_id = next(iter(repo.tenders))

    incoming = _record(
        source_record_id="c1",
        title="Suministro de material de oficina 2026",
        tax_id="P2800000A",
        expediente="EXP-2026-03",
        cpv_code="30192700",
        estimated_value="1000.00",
        publication_date="2026-03-01",
    )
    matched = match_records([incoming], source_code="catalunya", lookup=repo)
    decision = matched[0].payload["match"]
    assert decision["review_status"] == REVIEW_PENDING
    assert decision["review_status"] != REVIEW_AUTO
    assert decision["matched_tender_id"] == prior_id


def test_match_auto_on_tax_id_signals_when_one_side_lacks_expediente() -> None:
    """Sin expediente en un lado, NIF + ≥2 señales blandas sigue siendo auto."""
    repo = InMemoryCanonicalRepository()
    existing = _record(
        source_record_id="p1",
        title="Suministro de material de oficina",
        tax_id="P2800000A",
        expediente="EXP-2024-100",
        cpv_code="30192700",
        estimated_value="1000.00",
        publication_date="2024-06-01",
    )
    repo.upsert_records(source_code="placsp", records=[existing])
    tender_id = next(iter(repo.tenders))

    incoming = _record(
        source_record_id="c1",
        title="Suministro de material de oficina",
        tax_id="P2800000A",
        expediente=None,
        cpv_code="30192700",
        estimated_value="1000.00",
        publication_date="2024-06-01",
    )
    matched = match_records([incoming], source_code="catalunya", lookup=repo)
    decision = matched[0].payload["match"]
    assert decision["review_status"] == REVIEW_AUTO
    assert decision["match_method"] == METHOD_TAX_ID_SIGNALS
    assert decision["matched_tender_id"] == tender_id


def test_match_unmatched_when_no_overlap() -> None:
    repo = InMemoryCanonicalRepository()
    repo.upsert_records(
        source_code="placsp",
        records=[
            _record(
                source_record_id="placsp-1",
                title="Obras de pavimentación",
                tax_id="P2800000A",
                expediente="EXP-AAAA",
                cpv_code="45233140",
            )
        ],
    )
    incoming = _record(
        source_record_id="cat-1",
        title="Servicio de limpieza",
        tax_id="B12345678",
        expediente="EXP-BBBB",
        cpv_code="90910000",
        estimated_value="50.00",
        publication_date="2023-01-01",
    )
    matched = match_records([incoming], source_code="catalunya", lookup=repo)
    assert matched[0].payload["match"]["review_status"] == REVIEW_UNMATCHED
    assert matched[0].payload["match"]["matched_tender_id"] is None


def test_match_pending_when_two_auto_candidates() -> None:
    repo = InMemoryCanonicalRepository()
    shared = dict(
        title="Contrato marco de suministros",
        tax_id="P0800000B",
        expediente="EXP-DUP-1",
        cpv_code="30190000",
        estimated_value="5000.00",
        publication_date="2024-03-15",
    )
    repo.upsert_records(
        source_code="placsp",
        records=[_record(source_record_id="p1", **shared)],
    )
    repo.upsert_records(
        source_code="euskadi",
        records=[_record(source_record_id="e1", **shared)],
    )
    assert len(repo.tenders) == 2

    incoming = _record(source_record_id="c1", **shared)
    matched = match_records([incoming], source_code="catalunya", lookup=repo)
    decision = matched[0].payload["match"]
    assert decision["review_status"] == REVIEW_PENDING
    assert decision["matched_tender_id"] is None
    assert decision["reason"] == "ambiguous_auto_candidates"


def test_match_title_similarity_alone_is_pending_not_auto() -> None:
    """El mismo CPV mete al candidato en el pool; el título solo nunca hace auto-merge."""
    repo = InMemoryCanonicalRepository()
    repo.upsert_records(
        source_code="placsp",
        records=[
            _record(
                source_record_id="p1",
                title="Adquisición de equipos informáticos portátiles",
                tax_id="P2800000A",
                expediente="EXP-OLD",
                cpv_code="30213000",
                estimated_value="1000.00",
                publication_date="2024-06-01",
            )
        ],
    )
    incoming = _record(
        source_record_id="c1",
        title="Adquisición de equipos informáticos portátiles",
        tax_id="B99999999",
        expediente="EXP-NEW",
        cpv_code="30213000",
        estimated_value="9.99",
        publication_date="2020-01-01",
    )
    matched = match_records([incoming], source_code="catalunya", lookup=repo)
    decision = matched[0].payload["match"]
    assert decision["review_status"] == REVIEW_PENDING
    assert decision["match_method"] == METHOD_TITLE_SIMILARITY
    assert decision["matched_tender_id"] is not None


def test_stages_deduplicate_without_repo_marks_unmatched() -> None:
    records = [
        _record(
            source_record_id="x1",
            title="Cualquier título",
            tax_id="P2800000A",
            expediente="EXP-1",
        )
    ]
    out = stages.deduplicate(records, source_code="placsp")
    assert out[0].payload["match"]["review_status"] == REVIEW_UNMATCHED


def test_stages_deduplicate_uses_canonical_lookup() -> None:
    repo = InMemoryCanonicalRepository()
    existing = _record(
        source_record_id="p1",
        title="Misma licitación",
        tax_id="P2800000A",
        expediente="EXP-SHARED",
    )
    repo.upsert_records(source_code="placsp", records=[existing])
    tender_id = next(iter(repo.tenders))

    incoming = _record(
        source_record_id="c1",
        title="Misma licitación variante",
        tax_id="P2800000A",
        expediente="EXP-SHARED",
    )
    out = stages.deduplicate(
        [incoming],
        source_code="catalunya",
        canonical_repo=repo,
    )
    assert out[0].payload["match"]["review_status"] == REVIEW_AUTO
    assert out[0].payload["match"]["matched_tender_id"] == tender_id


def test_find_match_candidates_excludes_same_source() -> None:
    repo = InMemoryCanonicalRepository()
    repo.upsert_records(
        source_code="placsp",
        records=[
            _record(
                source_record_id="p1",
                title="Solo placsp",
                tax_id="P2800000A",
                expediente="EXP-1",
            )
        ],
    )
    candidates = repo.find_match_candidates(
        exclude_source_code="placsp",
        tax_id="P2800000A",
        expediente="EXP-1",
    )
    assert candidates == []
