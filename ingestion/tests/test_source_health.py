"""Unit tests for source_health (sin Postgres)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from efilicit_ingestion.ops.source_health import (
    SourceHealthRow,
    exit_code_for,
    format_health_report,
    mark_stale,
)


def test_mark_stale_fresh_success() -> None:
    now = datetime(2026, 10, 26, 12, 0, tzinfo=timezone.utc)
    rows = {
        "placsp": SourceHealthRow(
            source_code="placsp",
            status="success",
            run_id="r1",
            started_at=now - timedelta(hours=1),
            finished_at=now - timedelta(hours=1),
            error_message=None,
            records_seen=10,
            stale=True,
        )
    }
    out = mark_stale(rows, max_age=timedelta(hours=48), now=now)
    assert out["placsp"].stale is False


def test_mark_stale_old_or_failed() -> None:
    now = datetime(2026, 10, 26, 12, 0, tzinfo=timezone.utc)
    rows = {
        "placsp": SourceHealthRow(
            source_code="placsp",
            status="success",
            run_id="r1",
            started_at=now - timedelta(days=3),
            finished_at=now - timedelta(days=3),
            error_message=None,
            records_seen=1,
            stale=False,
        ),
        "euskadi": SourceHealthRow(
            source_code="euskadi",
            status="failed",
            run_id="r2",
            started_at=now,
            finished_at=now,
            error_message="boom",
            records_seen=0,
            stale=False,
        ),
        "catalunya": SourceHealthRow(
            source_code="catalunya",
            status=None,
            run_id=None,
            started_at=None,
            finished_at=None,
            error_message=None,
            records_seen=None,
            stale=False,
        ),
    }
    out = mark_stale(rows, max_age=timedelta(hours=48), now=now)
    assert out["placsp"].stale is True
    assert out["euskadi"].stale is True
    assert out["catalunya"].stale is True


def test_format_and_exit_codes() -> None:
    now = datetime(2026, 10, 26, 12, 0, tzinfo=timezone.utc)
    rows = {
        "placsp": SourceHealthRow(
            source_code="placsp",
            status="success",
            run_id="r1",
            started_at=now,
            finished_at=now,
            error_message=None,
            records_seen=3,
            stale=False,
        ),
        "euskadi": SourceHealthRow(
            source_code="euskadi",
            status="failed",
            run_id="r2",
            started_at=now,
            finished_at=now,
            error_message="x",
            records_seen=0,
            stale=True,
        ),
    }
    text = format_health_report(rows)
    assert "placsp" in text
    assert "euskadi" in text
    assert exit_code_for(rows, fail_on_stale=False) == 1
    ok_only = {
        "placsp": rows["placsp"],
    }
    assert exit_code_for(ok_only, fail_on_stale=False) == 0
    stale_ok_status = {
        "placsp": SourceHealthRow(
            source_code="placsp",
            status="success",
            run_id="r1",
            started_at=now,
            finished_at=now,
            error_message=None,
            records_seen=1,
            stale=True,
        )
    }
    assert exit_code_for(stale_ok_status, fail_on_stale=False) == 0
    assert exit_code_for(stale_ok_status, fail_on_stale=True) == 1
