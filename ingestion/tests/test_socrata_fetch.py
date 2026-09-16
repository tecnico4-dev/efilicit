"""Socrata / Catalunya fetch tests (Semana 3 Paso 7). No live network."""

from __future__ import annotations

from pathlib import Path

import pytest

from efilicit_ingestion.connectors.socrata import (
    SocrataConnector,
    SocrataHttpError,
    sha256_hex,
)
from efilicit_ingestion.models import SyncContext

FIXTURE = Path(__file__).parent / "fixtures" / "catalunya" / "valid_page.json"


def test_catalunya_fetch_uses_transport_and_checksum() -> None:
    body = FIXTURE.read_bytes()

    def transport(url: str) -> tuple[int, dict[str, str], bytes]:
        assert "ybgg-dgi6.json" in url
        return 200, {"content-type": "application/json"}, body

    connector = SocrataConnector(
        page_size=100,
        max_pages=1,
        fetch_transport=transport,
    )
    artifacts = connector.discover(
        SyncContext(source_code="catalunya", run_id="fetch-cat-1")
    )
    raw = connector.fetch(artifacts[0])
    assert raw == body
    assert sha256_hex(raw) == sha256_hex(body)


def test_catalunya_fetch_http_error_raises() -> None:
    connector = SocrataConnector(
        fetch_transport=lambda _url: (503, {}, b"unavailable"),
    )
    artifacts = connector.discover(
        SyncContext(source_code="catalunya", run_id="fetch-cat-err")
    )
    with pytest.raises(SocrataHttpError) as exc:
        connector.fetch(artifacts[0])
    assert exc.value.status_code == 503


def test_catalunya_fetch_respects_max_bytes() -> None:
    connector = SocrataConnector(
        max_bytes=8,
        fetch_transport=lambda _url: (200, {}, b"0123456789"),
    )
    artifacts = connector.discover(
        SyncContext(source_code="catalunya", run_id="fetch-cat-size")
    )
    with pytest.raises(Exception) as exc:
        connector.fetch(artifacts[0])
    assert "max_bytes" in str(exc.value)
