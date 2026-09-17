"""CLI / E2E Euskadi run tests (Semana 3 Paso 9)."""

from __future__ import annotations

from pathlib import Path

import psycopg
import pytest
import uuid

from efilicit_ingestion.cli import main
from efilicit_ingestion.pipeline.postgres import default_database_url
from efilicit_ingestion.run_euskadi import EuskadiRunConfig, format_result, run_euskadi

FIXTURE = Path(__file__).parent / "fixtures" / "euskadi" / "valid_page.json"


def test_cli_run_euskadi_dry_run_fixture(capsys: pytest.CaptureFixture[str]) -> None:
    code = main(
        [
            "run-euskadi",
            "--fixture",
            str(FIXTURE),
            "--dry-run",
            "--run-id",
            "cli-eus-dry-1",
        ]
    )
    captured = capsys.readouterr()
    assert code == 0
    assert "status=success" in captured.out
    assert "source_code=euskadi" in captured.out
    assert "records_seen=2" in captured.out
    assert "records_new=2" in captured.out
    assert "raw_path=raw/euskadi/" in captured.out


def test_run_euskadi_dry_run_programmatic() -> None:
    result = run_euskadi(
        EuskadiRunConfig(fixture_path=FIXTURE, dry_run=True, run_id="prog-eus-1")
    )
    assert result.sync.status == "success"
    assert result.records_processed == 2
    assert "status=success" in format_result(result)


def _db_available() -> bool:
    try:
        with psycopg.connect(default_database_url(), connect_timeout=2) as conn:
            conn.execute("select 1")
        return True
    except psycopg.Error:
        return False


@pytest.mark.skipif(not _db_available(), reason="Local Supabase Postgres not reachable")
def test_run_euskadi_fixture_writes_postgres_without_storage() -> None:
    run_id = f"e2e-eus-pg-{uuid.uuid4()}"
    result = run_euskadi(
        EuskadiRunConfig(
            fixture_path=FIXTURE,
            dry_run=False,
            use_storage=False,
            run_id=run_id,
        )
    )
    assert result.sync.status == "success"
    with psycopg.connect(default_database_url()) as conn:
        sync = conn.execute(
            """
            select status, records_seen
            from public.source_sync
            where source_code = 'euskadi' and run_id = %s
            """,
            (run_id,),
        ).fetchone()
        assert sync is not None and sync[0] == "success" and sync[1] == 2
