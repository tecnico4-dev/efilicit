"""parse_datetime_to_utc: offset → UTC; naive / solo fecha → Europe/Madrid → UTC."""

from __future__ import annotations

from datetime import datetime, timezone

from efilicit_ingestion.pipeline.canonical import parse_datetime_to_utc


def test_naive_datetime_assumes_madrid() -> None:
    # 2026-10-01 CEST (UTC+2)
    got = parse_datetime_to_utc("2026-10-01T14:00:00")
    assert got == datetime(2026, 10, 1, 12, 0, tzinfo=timezone.utc)


def test_zulu_stays_utc() -> None:
    got = parse_datetime_to_utc("2026-10-01T14:00:00Z")
    assert got == datetime(2026, 10, 1, 14, 0, tzinfo=timezone.utc)


def test_explicit_offset_converted() -> None:
    got = parse_datetime_to_utc("2026-10-01T14:00:00+02:00")
    assert got == datetime(2026, 10, 1, 12, 0, tzinfo=timezone.utc)


def test_date_only_midnight_madrid() -> None:
    # 00:00 Madrid CEST = 22:00 UTC del día anterior
    got = parse_datetime_to_utc("2026-10-01")
    assert got == datetime(2026, 9, 30, 22, 0, tzinfo=timezone.utc)


def test_empty_returns_none() -> None:
    assert parse_datetime_to_utc(None) is None
    assert parse_datetime_to_utc("") is None
