"""HTTP download for Socrata artifacts: timeout, retry, size limit, checksum."""

from __future__ import annotations

import hashlib
from collections.abc import Callable
from dataclasses import dataclass

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from efilicit_ingestion.connectors.socrata.errors import (
    ArtifactTooLargeError,
    SocrataFetchError,
    SocrataHttpError,
)

# JSON pages are far smaller than PLACSP monthly ZIPs.
DEFAULT_MAX_BYTES = 32 * 1024 * 1024
DEFAULT_TIMEOUT_SECONDS = 60.0
DEFAULT_RETRY_ATTEMPTS = 3

FetchTransport = Callable[[str], tuple[int, dict[str, str], bytes]]


def sha256_hex(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


@dataclass(frozen=True)
class FetchSettings:
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS
    max_bytes: int = DEFAULT_MAX_BYTES
    retry_attempts: int = DEFAULT_RETRY_ATTEMPTS


def download_bytes(
    url: str,
    *,
    settings: FetchSettings | None = None,
    transport: FetchTransport | None = None,
    http_client: httpx.Client | None = None,
) -> bytes:
    """Download URL bytes with timeout, retries, and size control.

    Prefer ``transport`` in unit tests (no network).
    """
    cfg = settings or FetchSettings()
    if cfg.max_bytes <= 0:
        raise ValueError("max_bytes must be positive")
    if cfg.retry_attempts < 1:
        raise ValueError("retry_attempts must be >= 1")

    @retry(
        retry=retry_if_exception_type((httpx.TransportError, httpx.TimeoutException)),
        stop=stop_after_attempt(cfg.retry_attempts),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=8),
        reraise=True,
    )
    def _once() -> bytes:
        if transport is not None:
            status, headers, body = transport(url)
            return _enforce_limits(url, status, headers, body, cfg.max_bytes)

        def _via_client(client: httpx.Client) -> bytes:
            with client.stream("GET", url) as response:
                status = response.status_code
                headers = {k.lower(): v for k, v in response.headers.items()}
                if status >= 400:
                    raise SocrataHttpError(status, url)
                content_length = headers.get("content-length")
                if content_length is not None:
                    try:
                        declared = int(content_length)
                    except ValueError as exc:
                        raise SocrataFetchError(
                            f"invalid Content-Length for {url}: {content_length!r}"
                        ) from exc
                    if declared > cfg.max_bytes:
                        raise ArtifactTooLargeError(
                            f"Content-Length {declared} exceeds max_bytes "
                            f"{cfg.max_bytes} for {url}"
                        )

                chunks: list[bytes] = []
                total = 0
                for chunk in response.iter_bytes():
                    total += len(chunk)
                    if total > cfg.max_bytes:
                        raise ArtifactTooLargeError(
                            f"downloaded size exceeds max_bytes {cfg.max_bytes} for {url}"
                        )
                    chunks.append(chunk)
                return b"".join(chunks)

        if http_client is not None:
            return _via_client(http_client)

        timeout = httpx.Timeout(cfg.timeout_seconds)
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            return _via_client(client)

    try:
        return _once()
    except SocrataFetchError:
        raise
    except httpx.TimeoutException as exc:
        raise SocrataFetchError(f"timeout fetching {url}") from exc
    except httpx.TransportError as exc:
        raise SocrataFetchError(f"transport error fetching {url}: {exc}") from exc


def _enforce_limits(
    url: str,
    status: int,
    headers: dict[str, str],
    body: bytes,
    max_bytes: int,
) -> bytes:
    if status >= 400:
        raise SocrataHttpError(status, url)

    normalized = {k.lower(): v for k, v in headers.items()}
    content_length = normalized.get("content-length")
    if content_length is not None:
        try:
            declared = int(content_length)
        except ValueError as exc:
            raise SocrataFetchError(
                f"invalid Content-Length for {url}: {content_length!r}"
            ) from exc
        if declared > max_bytes:
            raise ArtifactTooLargeError(
                f"Content-Length {declared} exceeds max_bytes {max_bytes} for {url}"
            )

    if len(body) > max_bytes:
        raise ArtifactTooLargeError(
            f"body size {len(body)} exceeds max_bytes {max_bytes} for {url}"
        )
    return body
