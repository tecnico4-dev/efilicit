"""Worker de intake contra Postgres local (ADR 035).

Storage y HTTP son fakes; la DB es la local. El worker hace commit, así que
cada test borra lo que crea. Skip sin DB local.
"""

from __future__ import annotations

import uuid
from pathlib import Path

import httpx
import psycopg
import pytest

from efilicit_ingestion.pipeline.postgres import default_database_url
from efilicit_ingestion.run_offer_intake import OfferIntakeRunConfig, run_offer_intake

FIXTURE = Path(__file__).parent / "fixtures" / "placsp" / "offer_terms_entry.atom"
PDF = b"%PDF-1.7\n" + b"y" * 64


def _db_available() -> bool:
    try:
        with psycopg.connect(default_database_url(), connect_timeout=2) as conn:
            conn.execute("select 1 from public.offer_case_intake limit 0")
        return True
    except psycopg.Error:
        return False


pytestmark = pytest.mark.skipif(
    not _db_available(),
    reason="Local Supabase Postgres (con ADR 035) no disponible",
)


class FakeStorage:
    def __init__(self) -> None:
        self.uploads: dict[str, bytes] = {}

    def download(self, storage_path: str) -> bytes:
        assert storage_path.startswith("raw/placsp/")
        return FIXTURE.read_bytes()

    def upload(self, *, object_key: str, raw: bytes, content_type: str) -> str:
        self.uploads[object_key] = raw
        return f"offer-docs/{object_key}"

    def close(self) -> None:
        pass


def _http() -> httpx.Client:
    def handler(request: httpx.Request) -> httpx.Response:
        if "ANEXO-1" in str(request.url):
            return httpx.Response(200, text="<html>no</html>", headers={"content-type": "text/html"})
        return httpx.Response(200, content=PDF, headers={"content-type": "application/pdf"})

    return httpx.Client(transport=httpx.MockTransport(handler))


@pytest.fixture
def case_ids():
    created: dict[str, uuid.UUID] = {}
    with psycopg.connect(default_database_url()) as conn:
        tender_id = conn.execute(
            "insert into public.tenders (title, canonical_source_code) "
            "values ('Intake test', 'placsp') returning id"
        ).fetchone()[0]
        artifact_id = conn.execute(
            "insert into public.source_artifacts (source_code, artifact_key, checksum, storage_path) "
            "values ('placsp', %s, 'x', %s) returning id",
            (f"entries/{uuid.uuid4()}.atom.xml", "raw/placsp/entries/test.atom.xml"),
        ).fetchone()[0]
        conn.execute(
            "insert into public.tender_sources (tender_id, source_code, source_tender_id, artifact_id) "
            "values (%s, 'placsp', %s, %s)",
            (tender_id, f"intake-{uuid.uuid4()}", artifact_id),
        )
        case_id = conn.execute(
            "insert into public.offer_cases (tender_id, stage) values (%s, 'interes') returning id",
            (tender_id,),
        ).fetchone()[0]
        conn.commit()
        created.update(tender=tender_id, artifact=artifact_id, case=case_id)
    yield created
    with psycopg.connect(default_database_url()) as conn:
        conn.execute("delete from public.offer_cases where id = %s", (created["case"],))
        conn.execute("delete from public.tenders where id = %s", (created["tender"],))
        conn.execute("delete from public.source_artifacts where id = %s", (created["artifact"],))
        conn.commit()


def _counts(case_id: uuid.UUID) -> dict[str, int]:
    with psycopg.connect(default_database_url()) as conn:
        out = {}
        for table in (
            "offer_case_pliegos",
            "offer_requirements",
            "offer_deliverables",
            "offer_milestones",
        ):
            out[table] = conn.execute(
                f"select count(*) from public.{table} where offer_case_id = %s", (case_id,)
            ).fetchone()[0]
        return out


def test_intake_populates_case_and_is_idempotent(case_ids) -> None:
    case_id = case_ids["case"]
    storage = FakeStorage()
    cfg = OfferIntakeRunConfig(offer_case_id=str(case_id), download_pause_seconds=0)

    first = run_offer_intake(cfg, storage=storage, http_client=_http())

    assert [j.status for j in first.jobs] == ["done"]
    stats = first.jobs[0].stats
    assert stats["documents_downloaded"] == 2
    assert stats["documents_failed"] == 1
    counts = _counts(case_id)
    assert counts["offer_case_pliegos"] == 5
    assert counts["offer_milestones"] == 2
    assert counts["offer_deliverables"] >= 1
    assert len(storage.uploads) == 1  # PCAP y PPT comparten bytes → misma clave

    with psycopg.connect(default_database_url()) as conn:
        statuses = dict(
            conn.execute(
                "select pliego_type || ':' || title, fetch_status from public.offer_case_pliegos "
                "where offer_case_id = %s",
                (case_id,),
            ).fetchall()
        )
        assert statuses["pcap:PCAP alumbrado.pdf"] == "descargado"
        assert statuses["otro:Memoria justificativa"] == "solo_enlace"
        assert statuses["anexo:Anexo I DeclaracionResponsable.docx"] == "error"
        pcap_linked = conn.execute(
            "select count(*) from public.offer_requirements "
            "where offer_case_id = %s and source_kind = 'pliego_xml' and pliego_id is not null",
            (case_id,),
        ).fetchone()[0]
        assert pcap_linked == counts["offer_requirements"]
        conn.execute(
            "update public.offer_requirements set title = 'Editado' "
            "where offer_case_id = %s and source_key = 'guar:definitiva:2'",
            (case_id,),
        )
        conn.commit()

    second = run_offer_intake(cfg, storage=storage, http_client=_http())

    assert second.jobs[0].status == "done"
    assert second.jobs[0].stats["requirements_new"] == 0
    assert second.jobs[0].stats["documents_failed"] == 1  # reintenta solo el que falló
    assert _counts(case_id) == counts
    with psycopg.connect(default_database_url()) as conn:
        title = conn.execute(
            "select title from public.offer_requirements "
            "where offer_case_id = %s and source_key = 'guar:definitiva:2'",
            (case_id,),
        ).fetchone()[0]
        assert title == "Editado"


def test_case_without_placsp_raw_is_skipped(case_ids) -> None:
    with psycopg.connect(default_database_url()) as conn:
        conn.execute("update public.tender_sources set artifact_id = null where tender_id = %s", (case_ids["tender"],))
        conn.commit()

    result = run_offer_intake(
        OfferIntakeRunConfig(offer_case_id=str(case_ids["case"])),
        storage=FakeStorage(),
        http_client=_http(),
    )

    assert result.jobs[0].status == "done"
    assert "skipped" in result.jobs[0].stats
    assert _counts(case_ids["case"])["offer_requirements"] == 0
