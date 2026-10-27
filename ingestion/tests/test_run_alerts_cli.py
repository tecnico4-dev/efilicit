"""CLI run-alerts (Semana 5 Paso 9) — dry-run por defecto."""

from __future__ import annotations

from datetime import date

import pytest

from efilicit_ingestion.cli import main
from efilicit_ingestion.run_alerts import AlertsRunConfig, format_result, run_alerts


def test_cli_run_alerts_default_is_dry_run(capsys: pytest.CaptureFixture[str]) -> None:
    code = main(["run-alerts", "--digest", "2026-09-30"])
    captured = capsys.readouterr()
    assert code == 0
    assert "mode=dry-run" in captured.out
    assert "phase=all" in captured.out
    assert "digest=2026-09-30" in captured.out
    assert "matches=1" in captured.out
    assert "enqueued_new=1" in captured.out
    assert "sent=1" in captured.out
    assert "emails_captured=1" in captured.out


def test_cli_run_alerts_send_without_write_fails(capsys: pytest.CaptureFixture[str]) -> None:
    code = main(["run-alerts", "--send"])
    captured = capsys.readouterr()
    assert code == 2
    assert "--send requires --write" in captured.err


def test_cli_run_alerts_send_with_phase_match_fails(
    capsys: pytest.CaptureFixture[str],
) -> None:
    code = main(["run-alerts", "--write", "--phase", "match", "--send"])
    captured = capsys.readouterr()
    assert code == 2
    assert "--send no aplica" in captured.err


def test_cli_run_alerts_phase_match_dry_run(capsys: pytest.CaptureFixture[str]) -> None:
    code = main(["run-alerts", "--phase", "match", "--digest", "2026-09-30"])
    captured = capsys.readouterr()
    assert code == 0
    assert "phase=match" in captured.out
    assert "matches=1" in captured.out
    assert "sent=0" in captured.out


def test_cli_run_alerts_phase_send_dry_run_empty_queue(
    capsys: pytest.CaptureFixture[str],
) -> None:
    # phase send alone: no prior enqueue in dry-run path → nothing to drain
    code = main(["run-alerts", "--phase", "send", "--digest", "2026-09-30"])
    captured = capsys.readouterr()
    assert code == 0
    assert "phase=send" in captured.out
    assert "matches=0" in captured.out
    assert "sent=0" in captured.out


def test_run_alerts_dry_run_programmatic() -> None:
    result = run_alerts(AlertsRunConfig(dry_run=True, digest=date(2026, 9, 30)))
    assert result.dry_run is True
    assert result.phase == "all"
    assert result.batch.matches == 1
    assert result.drain.digests_sent == 1
    assert result.emails_captured == 1
    text = format_result(result)
    assert "status=success" in text
    assert "mode=dry-run" in text
    assert "phase=all" in text


def test_run_alerts_phase_match_skips_drain() -> None:
    result = run_alerts(
        AlertsRunConfig(dry_run=True, digest=date(2026, 9, 30), phase="match")
    )
    assert result.batch.matches == 1
    assert result.drain.digests_sent == 0
    assert result.emails_captured == 0
