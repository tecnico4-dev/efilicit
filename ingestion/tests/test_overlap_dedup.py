"""Semana 4 Paso 7: fixture-driven overlap dedup + no-merge pairs (no network)."""

from __future__ import annotations

from pathlib import Path

from efilicit_ingestion.connectors.euskadi.parser import parse_euskadi_artifact
from efilicit_ingestion.connectors.placsp.parser import parse_placsp_artifact
from efilicit_ingestion.connectors.socrata import CATALUNYA
from efilicit_ingestion.connectors.socrata.parser import parse_socrata_artifact
from efilicit_ingestion.connectors.socrata.urls import page_artifact_key, page_resource_url
from efilicit_ingestion.models import RemoteArtifact
from efilicit_ingestion.pipeline import stages
from efilicit_ingestion.pipeline.canonical_repo import InMemoryCanonicalRepository
from efilicit_ingestion.pipeline.matching import REVIEW_AUTO, REVIEW_PENDING, REVIEW_UNMATCHED

OVERLAP = Path(__file__).parent / "fixtures" / "overlap"
PLACSP_FIXTURES = Path(__file__).parent / "fixtures" / "placsp"
CAT_FIXTURES = Path(__file__).parent / "fixtures" / "catalunya"


def _placsp_records(name: str, *, root: Path = OVERLAP):
    raw = (root / name).read_bytes()
    artifact = RemoteArtifact(
        artifact_key=name,
        source_url=f"https://example.invalid/{name}",
        content_type="application/atom+xml",
    )
    records = list(parse_placsp_artifact(raw, artifact))
    return stages.resolve_identity(stages.normalize(records))


def _euskadi_records(name: str):
    raw = (OVERLAP / name).read_bytes()
    artifact = RemoteArtifact(
        artifact_key=name,
        source_url=f"https://example.invalid/euskadi/{name}",
        content_type="application/json",
    )
    records = list(parse_euskadi_artifact(raw, artifact))
    return stages.resolve_identity(stages.normalize(records))


def _catalunya_records():
    raw = (CAT_FIXTURES / "valid_page.json").read_bytes()
    artifact = RemoteArtifact(
        artifact_key=page_artifact_key(CATALUNYA, offset=0, limit=1000),
        source_url=page_resource_url(CATALUNYA, offset=0, limit=1000),
        content_type="application/json",
        metadata={"dataset_id": CATALUNYA.dataset_id},
    )
    records = list(parse_socrata_artifact(raw, artifact))
    return stages.resolve_identity(stages.normalize(records))


def test_overlap_fixtures_auto_merge_placsp_and_euskadi() -> None:
    """Mismo expediente + NIF en Atom CODICE y JSON Euskadi → un tender."""
    repo = InMemoryCanonicalRepository()
    placsp = _placsp_records("same_tender_placsp.atom")
    assert len(placsp) == 1
    assert placsp[0].payload["canonical"]["authority"]["tax_id"] == "B76543210"
    assert placsp[0].payload["contract_folder_id"] == "EXP/2026/OVERLAP-001"

    repo.upsert_records(source_code="placsp", records=placsp)
    assert len(repo.tenders) == 1
    tender_id = next(iter(repo.tenders))

    euskadi = _euskadi_records("same_tender_euskadi.json")
    assert len(euskadi) == 1
    matched = stages.deduplicate(
        euskadi, source_code="euskadi", canonical_repo=repo
    )
    decision = matched[0].payload["match"]
    assert decision["review_status"] == REVIEW_AUTO
    assert decision["matched_tender_id"] == tender_id

    stats = repo.upsert_records(source_code="euskadi", records=matched)
    assert stats.new == 1
    assert len(repo.tenders) == 1
    assert len(repo.tender_sources) == 2
    eus_key = ("euskadi", "910001")
    assert eus_key in repo.tender_sources
    assert repo.tender_sources[eus_key]["tender_id"] == tender_id
    assert repo.tender_sources[eus_key]["review_status"] == REVIEW_AUTO

    # Idempotent second pass on the Euskadi side.
    again = stages.deduplicate(euskadi, source_code="euskadi", canonical_repo=repo)
    second = repo.upsert_records(source_code="euskadi", records=again)
    assert second.new == 0 and second.updated == 1
    assert len(repo.tenders) == 1
    assert len(repo.tender_sources) == 2


def test_overlap_fixtures_do_not_merge_distinct_tenders() -> None:
    """Different expediente + NIF must stay as two canonical rows."""
    repo = InMemoryCanonicalRepository()
    placsp = _placsp_records("same_tender_placsp.atom")
    repo.upsert_records(source_code="placsp", records=placsp)

    distinct = _euskadi_records("different_tender_euskadi.json")
    matched = stages.deduplicate(
        distinct, source_code="euskadi", canonical_repo=repo
    )
    assert matched[0].payload["match"]["review_status"] == REVIEW_UNMATCHED

    repo.upsert_records(source_code="euskadi", records=matched)
    assert len(repo.tenders) == 2
    assert len(repo.tender_sources) == 2
    assert repo.tender_sources[("euskadi", "910099")]["review_status"] == (
        REVIEW_UNMATCHED
    )


def test_existing_fixtures_expediente_without_tax_do_not_auto_merge() -> None:
    """Regresión: Catalunya sin NIF + PLACSP con mismo expediente → no auto."""
    repo = InMemoryCanonicalRepository()
    placsp = _placsp_records("valid_single_entry.atom", root=PLACSP_FIXTURES)
    repo.upsert_records(source_code="placsp", records=placsp)
    assert len(repo.tenders) == 1

    catalunya = _catalunya_records()[:1]
    assert catalunya[0].payload.get("contract_folder_id") == "EXP/2026/0001"
    assert catalunya[0].payload["canonical"]["authority"]["tax_id"] is None

    matched = stages.deduplicate(
        catalunya, source_code="catalunya", canonical_repo=repo
    )
    status = matched[0].payload["match"]["review_status"]
    assert status in {REVIEW_PENDING, REVIEW_UNMATCHED}
    assert status != REVIEW_AUTO

    repo.upsert_records(source_code="catalunya", records=matched)
    assert len(repo.tenders) == 2
    assert len(repo.tender_sources) == 2
