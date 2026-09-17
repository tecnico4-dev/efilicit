"""CLI / E2E PLACSP run tests (Semana 2–4: perfiles, agregadas, menores)."""

from __future__ import annotations

from pathlib import Path

import psycopg
import pytest
import uuid

from efilicit_ingestion.cli import main
from efilicit_ingestion.connectors.placsp.urls import PLACSP_AGREGADAS, PLACSP_MENORES
from efilicit_ingestion.pipeline.postgres import default_database_url
from efilicit_ingestion.run_placsp import PlacspRunConfig, format_result, run_placsp

FIXTURE = (
    Path(__file__).parent / "fixtures" / "placsp" / "valid_single_entry.atom"
)


def test_cli_help_still_works() -> None:
    assert main([]) == 0
    with pytest.raises(SystemExit) as exc:
        main(["--help"])
    assert exc.value.code == 0


def test_cli_run_placsp_dry_run_fixture(capsys: pytest.CaptureFixture[str]) -> None:
    code = main(
        [
            "run-placsp",
            "--fixture",
            str(FIXTURE),
            "--dry-run",
            "--as-of",
            "2026-09-11",
            "--run-id",
            "cli-dry-run-1",
        ]
    )
    captured = capsys.readouterr()
    assert code == 0
    assert "status=success" in captured.out
    assert "source_code=placsp" in captured.out
    assert "records_seen=1" in captured.out
    assert "records_new=1" in captured.out
    assert "raw_path=raw/placsp/" in captured.out


def test_cli_run_placsp_agregadas_dry_run_fixture(
    capsys: pytest.CaptureFixture[str],
) -> None:
    code = main(
        [
            "run-placsp",
            "--syndication",
            "placsp_agregadas",
            "--fixture",
            str(FIXTURE),
            "--dry-run",
            "--as-of",
            "2026-09-15",
            "--run-id",
            "cli-agregadas-dry-1",
        ]
    )
    captured = capsys.readouterr()
    assert code == 0
    assert "status=success" in captured.out
    assert "source_code=placsp_agregadas" in captured.out
    assert "records_seen=1" in captured.out
    assert "records_new=1" in captured.out
    assert "raw_path=raw/placsp_agregadas/" in captured.out


def test_run_placsp_dry_run_programmatic() -> None:
    result = run_placsp(
        PlacspRunConfig(
            fixture_path=FIXTURE,
            dry_run=True,
            as_of=__import__("datetime").date(2026, 9, 11),
            run_id="prog-dry-1",
        )
    )
    assert result.sync.status == "success"
    assert result.records_processed == 1
    assert result.stored_artifacts[0].checksum
    assert "status=success" in format_result(result)


def test_run_placsp_agregadas_dry_run_programmatic() -> None:
    result = run_placsp(
        PlacspRunConfig(
            syndication=PLACSP_AGREGADAS,
            fixture_path=FIXTURE,
            dry_run=True,
            as_of=__import__("datetime").date(2026, 9, 15),
            run_id="prog-agregadas-dry-1",
        )
    )
    assert result.sync.status == "success"
    assert result.sync.source_code == "placsp_agregadas"
    assert result.records_processed == 1
    assert result.stored_artifacts[0].storage_path.startswith("raw/placsp_agregadas/")


def test_cli_run_placsp_menores_dry_run_fixture(
    capsys: pytest.CaptureFixture[str],
) -> None:
    code = main(
        [
            "run-placsp",
            "--syndication",
            "placsp_menores",
            "--fixture",
            str(FIXTURE),
            "--dry-run",
            "--as-of",
            "2026-09-17",
            "--run-id",
            "cli-menores-dry-1",
        ]
    )
    captured = capsys.readouterr()
    assert code == 0
    assert "status=success" in captured.out
    assert "source_code=placsp_menores" in captured.out
    assert "records_seen=1" in captured.out
    assert "records_new=1" in captured.out
    assert "raw_path=raw/placsp_menores/" in captured.out


def test_run_placsp_menores_dry_run_programmatic() -> None:
    result = run_placsp(
        PlacspRunConfig(
            syndication=PLACSP_MENORES,
            fixture_path=FIXTURE,
            dry_run=True,
            as_of=__import__("datetime").date(2026, 9, 17),
            run_id="prog-menores-dry-1",
        )
    )
    assert result.sync.status == "success"
    assert result.sync.source_code == "placsp_menores"
    assert result.records_processed == 1
    assert result.stored_artifacts[0].storage_path.startswith("raw/placsp_menores/")


def _db_available() -> bool:
    try:
        with psycopg.connect(default_database_url(), connect_timeout=2) as conn:
            conn.execute("select 1")
        return True
    except psycopg.Error:
        return False


@pytest.mark.skipif(not _db_available(), reason="Local Supabase Postgres not reachable")
def test_run_placsp_fixture_writes_postgres_without_storage() -> None:
    run_id = f"e2e-fixture-pg-{uuid.uuid4()}"
    result = run_placsp(
        PlacspRunConfig(
            fixture_path=FIXTURE,
            dry_run=False,
            use_storage=False,
            as_of=__import__("datetime").date(2026, 9, 11),
            run_id=run_id,
        )
    )
    assert result.sync.status == "success"
    assert result.sync.records_seen >= 1

    with psycopg.connect(default_database_url()) as conn:
        sync = conn.execute(
            """
            select status, records_seen, records_new
            from public.source_sync
            where source_code = 'placsp' and run_id = %s
            """,
            (run_id,),
        ).fetchone()
        assert sync is not None
        assert sync[0] == "success"

        tender = conn.execute(
            """
            select count(*)
            from public.tender_sources
            where source_code = 'placsp'
              and source_tender_id = 'B00000000:EXP/2026/0001'
            """
        ).fetchone()
        assert tender is not None and tender[0] == 1


@pytest.mark.skipif(not _db_available(), reason="Local Supabase Postgres not reachable")
def test_run_placsp_agregadas_fixture_writes_postgres_without_storage() -> None:
    run_id = f"e2e-agregadas-pg-{uuid.uuid4()}"
    result = run_placsp(
        PlacspRunConfig(
            syndication=PLACSP_AGREGADAS,
            fixture_path=FIXTURE,
            dry_run=False,
            use_storage=False,
            as_of=__import__("datetime").date(2026, 9, 15),
            run_id=run_id,
        )
    )
    assert result.sync.status == "success"
    assert result.sync.source_code == "placsp_agregadas"
    assert result.sync.records_seen >= 1

    with psycopg.connect(default_database_url()) as conn:
        sync = conn.execute(
            """
            select status, records_seen, records_new
            from public.source_sync
            where source_code = 'placsp_agregadas' and run_id = %s
            """,
            (run_id,),
        ).fetchone()
        assert sync is not None
        assert sync[0] == "success"

        tender = conn.execute(
            """
            select count(*)
            from public.tender_sources
            where source_code = 'placsp_agregadas'
              and source_tender_id = 'B00000000:EXP/2026/0001'
            """
        ).fetchone()
        assert tender is not None and tender[0] == 1


@pytest.mark.skipif(not _db_available(), reason="Local Supabase Postgres not reachable")
def test_run_placsp_menores_fixture_writes_postgres_without_storage() -> None:
    run_id = f"e2e-menores-pg-{uuid.uuid4()}"
    result = run_placsp(
        PlacspRunConfig(
            syndication=PLACSP_MENORES,
            fixture_path=FIXTURE,
            dry_run=False,
            use_storage=False,
            as_of=__import__("datetime").date(2026, 9, 17),
            run_id=run_id,
        )
    )
    assert result.sync.status == "success"
    assert result.sync.source_code == "placsp_menores"
    assert result.sync.records_seen >= 1

    with psycopg.connect(default_database_url()) as conn:
        sync = conn.execute(
            """
            select status, records_seen, records_new
            from public.source_sync
            where source_code = 'placsp_menores' and run_id = %s
            """,
            (run_id,),
        ).fetchone()
        assert sync is not None
        assert sync[0] == "success"

        tender = conn.execute(
            """
            select count(*)
            from public.tender_sources
            where source_code = 'placsp_menores'
              and source_tender_id = 'B00000000:EXP/2026/0001'
            """
        ).fetchone()
        assert tender is not None and tender[0] == 1
