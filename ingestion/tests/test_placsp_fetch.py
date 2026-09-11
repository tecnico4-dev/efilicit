"""Unit tests for PLACSP fetch (Semana 2 Paso 3). No live network."""

from __future__ import annotations

from datetime import date

import httpx
import pytest

from efilicit_ingestion.connectors.placsp import PlacspConnector
from efilicit_ingestion.connectors.placsp.errors import (
    ArtifactTooLargeError,
    PlacspFetchError,
    PlacspHttpError,
)
from efilicit_ingestion.connectors.placsp.fetch import sha256_hex
from efilicit_ingestion.connectors.placsp.urls import (
    monthly_package_filename,
    monthly_package_url,
)
from efilicit_ingestion.models import RemoteArtifact


def _artifact(year: int = 2026, month: int = 9) -> RemoteArtifact:
    return RemoteArtifact(
        artifact_key=monthly_package_filename(year, month),
        source_url=monthly_package_url(year, month),
        content_type="application/zip",
    )


def test_fetch_success_returns_bytes_and_deterministic_checksum() -> None:
    payload = b"PK\x03\x04-fake-zip-payload"
    calls = {"n": 0}

    def transport(url: str) -> tuple[int, dict[str, str], bytes]:
        calls["n"] += 1
        assert url == monthly_package_url(2026, 9)
        return 200, {"content-type": "application/zip"}, payload

    connector = PlacspConnector(as_of=date(2026, 9, 11), fetch_transport=transport)
    first = connector.fetch(_artifact())
    second = connector.fetch(_artifact())

    assert first == payload
    assert second == payload
    assert sha256_hex(first) == sha256_hex(payload)
    assert calls["n"] == 2


def test_fetch_checksum_known_vector() -> None:
    # SHA-256("abc") — fixed vector to prove determinism.
    assert sha256_hex(b"abc") == (
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    )
    assert sha256_hex(b"abc") == sha256_hex(b"abc")


def test_fetch_rejects_oversized_content_length() -> None:
    def transport(url: str) -> tuple[int, dict[str, str], bytes]:
        _ = url
        return 200, {"content-length": "1000"}, b"tiny"

    connector = PlacspConnector(fetch_transport=transport, max_bytes=100)
    with pytest.raises(ArtifactTooLargeError):
        connector.fetch(_artifact())


def test_fetch_rejects_oversized_body() -> None:
    def transport(url: str) -> tuple[int, dict[str, str], bytes]:
        _ = url
        return 200, {}, b"x" * 50

    connector = PlacspConnector(fetch_transport=transport, max_bytes=32)
    with pytest.raises(ArtifactTooLargeError):
        connector.fetch(_artifact())


def test_fetch_http_error() -> None:
    def transport(url: str) -> tuple[int, dict[str, str], bytes]:
        _ = url
        return 404, {}, b"missing"

    connector = PlacspConnector(fetch_transport=transport)
    with pytest.raises(PlacspHttpError) as exc_info:
        connector.fetch(_artifact())
    assert exc_info.value.status_code == 404


def test_fetch_retries_then_succeeds_with_httpx_mock() -> None:
    attempts = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        attempts["n"] += 1
        if attempts["n"] < 3:
            raise httpx.ConnectError("temporary", request=request)
        return httpx.Response(200, content=b"recovered-zip")

    client = httpx.Client(transport=httpx.MockTransport(handler))
    connector = PlacspConnector(http_client=client, retry_attempts=3)
    raw = connector.fetch(_artifact())
    assert raw == b"recovered-zip"
    assert attempts["n"] == 3
    client.close()


def test_fetch_timeout_is_classified() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=request)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    connector = PlacspConnector(http_client=client, retry_attempts=2)
    with pytest.raises(PlacspFetchError) as exc_info:
        connector.fetch(_artifact())
    client.close()
    assert "timeout" in str(exc_info.value).lower()


def test_fetch_requires_source_url() -> None:
    connector = PlacspConnector(
        fetch_transport=lambda url: (200, {}, b"x"),
    )
    with pytest.raises(ValueError):
        connector.fetch(RemoteArtifact(artifact_key="no-url.zip", source_url=None))
