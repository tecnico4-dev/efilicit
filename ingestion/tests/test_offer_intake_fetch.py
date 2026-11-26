from __future__ import annotations

import httpx
import pytest

from efilicit_ingestion.offer_intake.fetch import DocumentFetchError, fetch_document

PDF = b"%PDF-1.7\n" + b"x" * 100


def _client(handler) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_pdf_download_with_checksum_and_filename() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["user-agent"].startswith("efilicit-ingestion/")
        return httpx.Response(
            200,
            content=PDF,
            headers={
                "content-type": "application/octet-stream",
                "content-disposition": 'attachment; filename="PCAP.pdf"',
            },
        )

    doc = fetch_document(_client(handler), "https://example.invalid/FileSystem/servlet/x")

    assert doc.extension == "pdf"
    assert doc.content_type == "application/pdf"
    assert doc.filename == "PCAP.pdf"
    assert doc.byte_size == len(PDF)
    assert len(doc.checksum) == 64


def test_html_response_is_an_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="<html>Request Rejected</html>", headers={"content-type": "text/html"})

    with pytest.raises(DocumentFetchError, match="HTML"):
        fetch_document(_client(handler), "https://example.invalid/doc")


def test_size_limit_and_http_errors() -> None:
    def big(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=PDF, headers={"content-type": "application/pdf"})

    with pytest.raises(DocumentFetchError, match="grande"):
        fetch_document(_client(big), "https://example.invalid/doc", max_bytes=10)

    def missing(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404)

    with pytest.raises(DocumentFetchError, match="404"):
        fetch_document(_client(missing), "https://example.invalid/doc")
