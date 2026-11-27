"""Ventana reciente Euskadi: fechas + binary search (sin red)."""

from __future__ import annotations

import json

import pytest

from efilicit_ingestion.connectors.euskadi.connector import EuskadiConnector
from efilicit_ingestion.connectors.euskadi.recent_window import (
    find_first_dated_page,
    item_has_publication_date,
    page_has_publication_date,
)
from efilicit_ingestion.models import SyncContext


def _page(*, dated: bool, page: int, total_pages: int = 20) -> dict:
    item: dict = {"id": page * 10, "name": f"aviso-{page}"}
    if dated:
        item["lastPublicationDate"] = "2026-11-25T10:00:00+01:00"
    return {
        "totalPages": total_pages,
        "totalItems": total_pages * 10,
        "items": [item],
    }


def test_item_and_page_date_helpers() -> None:
    assert not item_has_publication_date({"id": 1})
    assert item_has_publication_date(
        {"id": 1, "lastPublicationDate": "2026-01-01"}
    )
    assert page_has_publication_date(_page(dated=True, page=5))
    assert not page_has_publication_date(_page(dated=False, page=1))


def test_find_first_dated_page_binary_search() -> None:
    # Páginas 1..7 sin fecha; 8..20 con fecha.
    calls: list[int] = []

    def fetch(page: int) -> dict:
        calls.append(page)
        return _page(dated=page >= 8, page=page, total_pages=20)

    assert find_first_dated_page(total_pages=20, fetch_page=fetch) == 8
    assert len(calls) < 20  # no lineal completo


def test_find_first_dated_page_all_dated() -> None:
    def fetch(page: int) -> dict:
        return _page(dated=True, page=page, total_pages=5)

    assert find_first_dated_page(total_pages=5, fetch_page=fetch) == 1


def test_find_first_dated_page_none_raises() -> None:
    def fetch(page: int) -> dict:
        return _page(dated=False, page=page, total_pages=4)

    with pytest.raises(RuntimeError, match="no page with publication dates"):
        find_first_dated_page(total_pages=4, fetch_page=fetch)


def test_discover_auto_recent_starts_at_dated_frontier() -> None:
    total = 12
    frontier = 5

    def transport(url: str) -> tuple[int, dict[str, str], bytes]:
        # ...?currentPage=N
        page = int(url.rsplit("=", 1)[-1])
        payload = _page(dated=page >= frontier, page=page, total_pages=total)
        raw = json.dumps(payload).encode("utf-8")
        return 200, {"content-type": "application/json"}, raw

    connector = EuskadiConnector(
        max_pages=3,
        start_page=1,
        auto_recent=True,
        fetch_transport=transport,
    )
    # Cursor antiguo no debe saltar la ventana reciente.
    arts = connector.discover(
        SyncContext(
            source_code="euskadi",
            run_id="auto-1",
            cursor="contracting-notices_page_000099.json",
        )
    )
    assert [a.metadata["current_page"] for a in arts] == [5, 6, 7]
    assert arts[0].metadata["auto_recent"] is True
    assert arts[0].metadata["recent_start_page"] == 5


def test_discover_fixed_start_still_respects_cursor() -> None:
    connector = EuskadiConnector(max_pages=3, start_page=1, auto_recent=False)
    arts = connector.discover(
        SyncContext(
            source_code="euskadi",
            run_id="fixed-1",
            cursor="contracting-notices_page_000001.json",
        )
    )
    assert [a.metadata["current_page"] for a in arts] == [2, 3]
