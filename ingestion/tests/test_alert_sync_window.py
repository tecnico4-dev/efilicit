"""Ventana de match post-ingesta (ADR 020) — helpers puros sin Postgres."""

from __future__ import annotations

from datetime import datetime, timezone

from efilicit_ingestion.alerts.postgres import tender_touch_in_sync_windows


def test_tender_touch_inside_window() -> None:
    start = datetime(2026, 10, 27, 5, 0, tzinfo=timezone.utc)
    end = datetime(2026, 10, 27, 7, 30, tzinfo=timezone.utc)
    touch = datetime(2026, 10, 27, 6, 15, tzinfo=timezone.utc)
    assert tender_touch_in_sync_windows(touch, [(start, end)]) is True


def test_tender_touch_outside_window() -> None:
    start = datetime(2026, 10, 27, 5, 0, tzinfo=timezone.utc)
    end = datetime(2026, 10, 27, 7, 30, tzinfo=timezone.utc)
    touch = datetime(2026, 10, 26, 12, 0, tzinfo=timezone.utc)
    assert tender_touch_in_sync_windows(touch, [(start, end)]) is False


def test_tender_touch_inclusive_bounds() -> None:
    start = datetime(2026, 10, 27, 5, 0, tzinfo=timezone.utc)
    end = datetime(2026, 10, 27, 7, 0, tzinfo=timezone.utc)
    assert tender_touch_in_sync_windows(start, [(start, end)]) is True
    assert tender_touch_in_sync_windows(end, [(start, end)]) is True


def test_tender_touch_empty_windows_or_none() -> None:
    touch = datetime(2026, 10, 27, 6, 0, tzinfo=timezone.utc)
    assert tender_touch_in_sync_windows(touch, []) is False
    assert tender_touch_in_sync_windows(None, [(touch, touch)]) is False


def test_tender_touch_any_of_several_windows() -> None:
    w1 = (
        datetime(2026, 10, 27, 5, 0, tzinfo=timezone.utc),
        datetime(2026, 10, 27, 5, 45, tzinfo=timezone.utc),
    )
    w2 = (
        datetime(2026, 10, 27, 6, 0, tzinfo=timezone.utc),
        datetime(2026, 10, 27, 7, 0, tzinfo=timezone.utc),
    )
    touch = datetime(2026, 10, 27, 6, 30, tzinfo=timezone.utc)
    assert tender_touch_in_sync_windows(touch, [w1, w2]) is True
