"""CLI / E2E Catalunya run tests (Semana 3 Paso 8.4)."""

from __future__ import annotations

from pathlib import Path

import psycopg
import pytest
import uuid

from efilicit_ingestion.cli import main
from efilicit_ingestion.pipeline.postgres import default_database_url
from efilicit_ingestion.run_catalunya import CatalunyaRunConfig, format_result, run_catalunya

FIXTURE = Path(__file__).parent / "fixtures" / "catalunya" / "valid_page.json"


def test_cli_run_catalunya_dry_run_fixture(capsys: pytest.CaptureFixture[str]) -> None:
    code = main(
        [
            "run-catalunya",
            "--fixture",
            str(FIXTURE),
            "--dry-run",
            "--run-id",
            "cli-cat-dry-1",
        ]
    )
    captured = capsys.readouterr()
    assert code == 0
    assert "status=success" in captured.out
    assert "source_code=catalunya" in captured.out
    assert "records_seen=2" in captured.out
    assert "records_new=2" in captured.out
    assert "raw_path=raw/catalunya/" in captured.out


def test_cli_run_catalunya_dry_run_requires_fixture(
    capsys: pytest.CaptureFixture[str],
) -> None:
    code = main(["run-catalunya", "--dry-run"])
    captured = capsys.readouterr()
    assert code == 2
    assert "requires --fixture" in captured.err


def test_run_catalunya_dry_run_programmatic() -> None:
    result = run_catalunya(
        CatalunyaRunConfig(
            fixture_path=FIXTURE,
            dry_run=True,
            run_id="prog-cat-dry-1",
        )
    )
    assert result.sync.status == "success"
    assert result.sync.source_code == "catalunya"
    assert result.records_processed == 2
    assert result.stored_artifacts[0].storage_path.startswith("raw/catalunya/")
    assert "status=success" in format_result(result)


def _db_available() -> bool:
    try:
        with psycopg.connect(default_database_url(), connect_timeout=2) as conn:
            conn.execute("select 1")
        return True
    except psycopg.Error:
        return False


@pytest.mark.skipif(not _db_available(), reason="Local Supabase Postgres not reachable")
def test_run_catalunya_fixture_writes_postgres_without_storage() -> None:
    run_id = f"e2e-cat-pg-{uuid.uuid4()}"
    result = run_catalunya(
        CatalunyaRunConfig(
            fixture_path=FIXTURE,
            dry_run=False,
            use_storage=False,
            run_id=run_id,
        )
    )
    assert result.sync.status == "success"
    assert result.sync.source_code == "catalunya"
    assert result.sync.records_seen == 2

    with psycopg.connect(default_database_url()) as conn:
        sync = conn.execute(
            """
            select status, records_seen, records_new
            from public.source_sync
            where source_code = 'catalunya' and run_id = %s
            """,
            (run_id,),
        ).fetchone()
        assert sync is not None
        assert sync[0] == "success"
        assert sync[1] == 2

        tender = conn.execute(
            """
            select count(*)
            from public.tender_sources
            where source_code = 'catalunya'
              and source_tender_id = 'aaaaaaaa-bbbb-cccc-dddd-000000000001'
            """
        ).fetchone()
        assert tender is not None and tender[0] == 1
