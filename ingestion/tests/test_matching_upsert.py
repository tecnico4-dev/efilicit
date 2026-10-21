"""Semana 4 Paso 6: upsert reuses tenders.id on auto match; no merge on pending."""

from __future__ import annotations

from decimal import Decimal

import psycopg
import pytest

from efilicit_ingestion.models import SourceRecord
from efilicit_ingestion.pipeline import stages
from efilicit_ingestion.pipeline.canonical_repo import (
    InMemoryCanonicalRepository,
    PostgresCanonicalRepository,
)
from efilicit_ingestion.pipeline.matching import (
    REVIEW_AUTO,
    REVIEW_PENDING,
    REVIEW_UNMATCHED,
    match_records,
)
from efilicit_ingestion.pipeline.postgres import connect, default_database_url


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
    return SourceRecord(
        source_record_id=source_record_id,
        payload={
            "contract_folder_id": expediente,
            "canonical": {
                "source_tender_id": source_tender_id,
                "title": title,
                "cpv_codes": [cpv_code] if cpv_code else [],
                "estimated_value": (
                    Decimal(str(estimated_value))
                    if estimated_value is not None
                    else None
                ),
                "publication_date": publication_date,
                "status": "publicada",
                "authority": {
                    "tax_id": tax_id,
                    "name": "Ayuntamiento de Prueba",
                    "country_code": "ES",
                    "tax_id_country": "ES",
                },
            },
        },
    )


def test_upsert_auto_reuses_single_tender_across_sources() -> None:
    repo = InMemoryCanonicalRepository()
    first = _record(
        source_record_id="p1",
        title="Suministro compartido",
        tax_id="P2800000A",
        expediente="EXP-SHARE-1",
    )
    repo.upsert_records(source_code="placsp", records=[first])
    assert len(repo.tenders) == 1
    tender_id = next(iter(repo.tenders))

    second = _record(
        source_record_id="c1",
        title="Suministro compartido (CAT)",
        tax_id="P2800000A",
        expediente="EXP-SHARE-1",
    )
    annotated = match_records([second], source_code="catalunya", lookup=repo)
    assert annotated[0].payload["match"]["review_status"] == REVIEW_AUTO

    stats = repo.upsert_records(source_code="catalunya", records=annotated)
    assert stats.new == 1
    assert len(repo.tenders) == 1
    assert len(repo.tender_sources) == 2
    cat_link = repo.tender_sources[("catalunya", "P2800000A:EXP-SHARE-1")]
    assert cat_link["tender_id"] == tender_id
    assert cat_link["review_status"] == REVIEW_AUTO
    assert cat_link["match_method"] is not None
    assert cat_link["matched_at"] is not None
    assert cat_link["match_candidate_tender_id"] is None


def test_upsert_pending_creates_separate_tender() -> None:
    """Title similarity + shared CPV → pending with best candidate id persisted."""
    repo = InMemoryCanonicalRepository()
    repo.upsert_records(
        source_code="placsp",
        records=[
            _record(
                source_record_id="p1",
                title="Contrato marco de suministros especiales XYZ",
                tax_id="P0800000B",
                expediente="EXP-PLACSP-1",
                cpv_code="30213000",
                estimated_value="1000.00",
                publication_date="2024-06-01",
            )
        ],
    )
    prior_id = next(iter(repo.tenders))

    incoming = _record(
        source_record_id="c1",
        title="Contrato marco de suministros especiales XYZ",
        tax_id="B99999999",
        expediente="EXP-CAT-9",
        cpv_code="30213000",
        estimated_value="9.99",
        publication_date="2020-01-01",
    )
    annotated = match_records([incoming], source_code="catalunya", lookup=repo)
    assert annotated[0].payload["match"]["review_status"] == REVIEW_PENDING
    suggested = annotated[0].payload["match"].get("matched_tender_id")
    assert suggested == prior_id

    repo.upsert_records(source_code="catalunya", records=annotated)
    assert len(repo.tenders) == 2
    cat_link = next(v for k, v in repo.tender_sources.items() if k[0] == "catalunya")
    assert cat_link["review_status"] == REVIEW_PENDING
    assert cat_link["match_candidate_tender_id"] == prior_id
    assert cat_link["tender_id"] != prior_id


def test_upsert_auto_leaves_match_candidate_null() -> None:
    repo = InMemoryCanonicalRepository()
    first = _record(
        source_record_id="p1",
        title="Suministro compartido",
        tax_id="P2800000A",
        expediente="EXP-SHARE-1",
    )
    repo.upsert_records(source_code="placsp", records=[first])
    second = _record(
        source_record_id="c1",
        title="Suministro compartido (CAT)",
        tax_id="P2800000A",
        expediente="EXP-SHARE-1",
    )
    annotated = match_records([second], source_code="catalunya", lookup=repo)
    repo.upsert_records(source_code="catalunya", records=annotated)
    cat_link = repo.tender_sources[("catalunya", "P2800000A:EXP-SHARE-1")]
    assert cat_link["review_status"] == REVIEW_AUTO
    assert cat_link["match_candidate_tender_id"] is None


def test_pending_reingest_refreshes_match_candidate() -> None:
    repo = InMemoryCanonicalRepository()
    title = "Servicio de limpieza edificios municipales UNIQUE"
    repo.upsert_records(
        source_code="placsp",
        records=[
            _record(
                source_record_id="p1",
                title=title,
                tax_id="P0800000B",
                expediente="EXP-REFR-P",
                cpv_code="30213000",
                estimated_value="1000.00",
                publication_date="2024-06-01",
            )
        ],
    )
    placsp_id = next(iter(repo.tenders))
    incoming = _record(
        source_record_id="c1",
        title=title,
        tax_id="B11111111",
        expediente="EXP-REFR-C",
        cpv_code="30213000",
        estimated_value="9.99",
        publication_date="2019-01-01",
    )
    annotated = match_records([incoming], source_code="catalunya", lookup=repo)
    assert annotated[0].payload["match"]["review_status"] == REVIEW_PENDING
    repo.upsert_records(source_code="catalunya", records=annotated)
    key = ("catalunya", "B11111111:EXP-REFR-C")
    assert repo.tender_sources[key]["match_candidate_tender_id"] == placsp_id

    repo.upsert_records(
        source_code="euskadi",
        records=[
            _record(
                source_record_id="e1",
                title=title,
                tax_id="P22222222",
                expediente="EXP-REFR-E",
                cpv_code="30213000",
                estimated_value="9.99",
                publication_date="2019-01-01",
            )
        ],
    )
    reannotated = match_records([incoming], source_code="catalunya", lookup=repo)
    assert reannotated[0].payload["match"]["review_status"] == REVIEW_PENDING
    new_best = reannotated[0].payload["match"].get("matched_tender_id")
    assert new_best is not None
    repo.upsert_records(source_code="catalunya", records=reannotated)
    assert repo.tender_sources[key]["review_status"] == REVIEW_PENDING
    assert repo.tender_sources[key]["match_candidate_tender_id"] == new_best


def test_upsert_unmatched_creates_new_tender() -> None:
    repo = InMemoryCanonicalRepository()
    repo.upsert_records(
        source_code="placsp",
        records=[
            _record(
                source_record_id="p1",
                title="Obras",
                tax_id="P2800000A",
                expediente="EXP-A",
                cpv_code="45233140",
            )
        ],
    )
    incoming = _record(
        source_record_id="c1",
        title="Limpieza",
        tax_id="B12345678",
        expediente="EXP-B",
        cpv_code="90910000",
        estimated_value="10.00",
        publication_date="2020-01-01",
    )
    annotated = stages.deduplicate(
        [incoming], source_code="catalunya", canonical_repo=repo
    )
    assert annotated[0].payload["match"]["review_status"] == REVIEW_UNMATCHED
    repo.upsert_records(source_code="catalunya", records=annotated)
    assert len(repo.tenders) == 2
    assert len(repo.tender_sources) == 2
    cat_link = next(v for k, v in repo.tender_sources.items() if k[0] == "catalunya")
    assert cat_link["review_status"] == REVIEW_UNMATCHED
    assert cat_link.get("match_candidate_tender_id") is None


def test_upsert_second_pass_does_not_duplicate_tender_sources() -> None:
    repo = InMemoryCanonicalRepository()
    first = _record(
        source_record_id="p1",
        title="Idempotente",
        tax_id="P2800000A",
        expediente="EXP-IDEM",
    )
    repo.upsert_records(source_code="placsp", records=[first])
    tender_id = next(iter(repo.tenders))

    second = _record(
        source_record_id="c1",
        title="Idempotente CAT",
        tax_id="P2800000A",
        expediente="EXP-IDEM",
    )
    annotated = match_records([second], source_code="catalunya", lookup=repo)
    first_stats = repo.upsert_records(source_code="catalunya", records=annotated)
    second_stats = repo.upsert_records(source_code="catalunya", records=annotated)

    assert first_stats.new == 1
    assert second_stats.new == 0 and second_stats.updated == 0
    assert len(repo.tenders) == 1
    assert len(repo.tender_sources) == 2
    assert repo.tender_sources[("catalunya", "P2800000A:EXP-IDEM")]["tender_id"] == (
        tender_id
    )


def _db_available() -> bool:
    try:
        with psycopg.connect(default_database_url(), connect_timeout=2) as conn:
            conn.execute("select 1")
        return True
    except psycopg.Error:
        return False


@pytest.mark.skipif(not _db_available(), reason="Local Supabase Postgres not reachable")
def test_postgres_upsert_auto_merges_and_is_idempotent() -> None:
    tax_id = "P9999000Z"
    expediente = "EXP-PG-MATCH-1"
    placsp_id = f"{tax_id}:{expediente}"
    cat_id = f"{tax_id}:{expediente}"

    with connect() as conn:
        conn.execute(
            """
            delete from public.tenders t
            using public.tender_sources ts
            where ts.tender_id = t.id
              and ts.source_tender_id = %s
            """,
            (placsp_id,),
        )
        conn.execute(
            "delete from public.contracting_authorities where tax_id = %s",
            (tax_id,),
        )
        conn.commit()

        repo = PostgresCanonicalRepository(conn)
        placsp = _record(
            source_record_id="pg-p1",
            title="Match Postgres auto",
            tax_id=tax_id,
            expediente=expediente,
        )
        repo.upsert_records(source_code="placsp", records=[placsp])

        cat = _record(
            source_record_id="pg-c1",
            title="Match Postgres auto CAT",
            tax_id=tax_id,
            expediente=expediente,
        )
        annotated = match_records([cat], source_code="catalunya", lookup=repo)
        assert annotated[0].payload["match"]["review_status"] == REVIEW_AUTO

        first = repo.upsert_records(source_code="catalunya", records=annotated)
        second = repo.upsert_records(source_code="catalunya", records=annotated)
        conn.commit()

        assert first.new == 1 and second.updated == 0

        tender_count = conn.execute(
            """
            select count(distinct tender_id)
            from public.tender_sources
            where source_tender_id = %s
            """,
            (placsp_id,),
        ).fetchone()
        assert tender_count is not None and tender_count[0] == 1

        links = conn.execute(
            """
            select source_code, review_status, match_method, match_candidate_tender_id
            from public.tender_sources
            where source_tender_id = %s
            order by source_code
            """,
            (cat_id,),
        ).fetchall()
        assert len(links) == 2
        by_source = {row[0]: row for row in links}
        assert by_source["catalunya"][1] == REVIEW_AUTO
        assert by_source["catalunya"][2] is not None
        assert by_source["catalunya"][3] is None
