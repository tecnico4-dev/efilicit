"""Paginación de la ventana de candidatos de alertas (sin Postgres)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from efilicit_ingestion.alerts.models import TenderCandidate
from efilicit_ingestion.alerts.postgres import collect_paginated_candidates


def _cand(n: int, *, touch: datetime) -> tuple[TenderCandidate, datetime]:
    return (
        TenderCandidate(
            id=f"00000000-0000-4000-8000-{n:012d}",
            title=f"Tender {n}",
            updated_at=touch,
        ),
        touch,
    )


def test_collect_paginated_candidates_walks_all_pages() -> None:
    base = datetime(2026, 10, 22, 12, 0, tzinfo=timezone.utc)
    # 5 filas, páginas de 2 → 3 fetches (2+2+1).
    rows = [_cand(i, touch=base - timedelta(minutes=i)) for i in range(5)]
    calls: list[tuple[datetime | None, str | None]] = []

    def fetch_page(
        before_touch_at: datetime | None,
        before_id: str | None,
    ) -> list[tuple[TenderCandidate, datetime]]:
        calls.append((before_touch_at, before_id))
        remaining = rows
        if before_touch_at is not None and before_id is not None:
            remaining = [
                (c, t)
                for c, t in rows
                if t < before_touch_at or (t == before_touch_at and c.id < before_id)
            ]
        return remaining[:2]

    out = collect_paginated_candidates(fetch_page, page_size=2)
    assert [c.id for c in out] == [r[0].id for r in rows]
    assert len(calls) == 3


def test_collect_paginated_candidates_stops_on_empty_first_page() -> None:
    def fetch_page(
        before_touch_at: datetime | None,
        before_id: str | None,
    ) -> list[tuple[TenderCandidate, datetime]]:
        return []

    assert collect_paginated_candidates(fetch_page, page_size=5000) == []


def test_collect_paginated_candidates_dedupes_ids() -> None:
    base = datetime(2026, 10, 22, 12, 0, tzinfo=timezone.utc)
    twin = _cand(1, touch=base)
    other = _cand(2, touch=base - timedelta(minutes=1))

    def fetch_page(
        before_touch_at: datetime | None,
        before_id: str | None,
    ) -> list[tuple[TenderCandidate, datetime]]:
        if before_id is None:
            return [twin, twin, other]
        return []

    out = collect_paginated_candidates(fetch_page, page_size=3)
    assert [c.id for c in out] == [twin[0].id, other[0].id]
