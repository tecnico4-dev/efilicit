"""Storage para el intake: leer RAW (bucket ``raw``) y subir pliegos (``offer-docs``).

``service_role`` solo en el worker batch (ADR 035); la web lee con signed URLs.
"""

from __future__ import annotations

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from efilicit_ingestion.pipeline.supabase_storage import (
    SupabaseStorageError,
    default_service_role_key,
    default_supabase_url,
    storage_api_base_url,
)

OFFER_DOCS_BUCKET = "offer-docs"


class _Retryable(SupabaseStorageError):
    pass


def split_storage_path(storage_path: str) -> tuple[str, str]:
    """``raw/placsp/entries/x.atom.xml`` → ``("raw", "placsp/entries/x.atom.xml")``."""
    bucket, _, key = storage_path.strip("/").partition("/")
    if not bucket or not key:
        raise ValueError(f"invalid storage_path: {storage_path!r}")
    return bucket, key


class IntakeStorage:
    def __init__(
        self,
        *,
        base_url: str | None = None,
        service_role_key: str | None = None,
        http_client: httpx.Client | None = None,
    ) -> None:
        key = service_role_key or default_service_role_key()
        if not key:
            raise ValueError("SUPABASE_SERVICE_ROLE_KEY is required for offer intake")
        self._base_url = storage_api_base_url(base_url or default_supabase_url())
        self._headers = {"Authorization": f"Bearer {key}", "apikey": key}
        self._client = http_client or httpx.Client(
            timeout=httpx.Timeout(120.0, connect=30.0), follow_redirects=True
        )

    def close(self) -> None:
        self._client.close()

    def download(self, storage_path: str) -> bytes:
        bucket, key = split_storage_path(storage_path)
        url = f"{self._base_url}/storage/v1/object/{bucket}/{key}"

        @retry(
            retry=retry_if_exception_type((httpx.TransportError, _Retryable)),
            stop=stop_after_attempt(3),
            wait=wait_exponential(multiplier=0.5, max=6),
            reraise=True,
        )
        def _once() -> bytes:
            response = self._client.get(url, headers=self._headers)
            if response.status_code >= 500:
                raise _Retryable(f"Storage GET {response.status_code} for {storage_path}")
            if response.status_code >= 400:
                raise SupabaseStorageError(
                    f"Storage GET {response.status_code} for {storage_path}: {response.text[:200]}"
                )
            return response.content

        return _once()

    def upload(self, *, object_key: str, raw: bytes, content_type: str) -> str:
        """Sube a ``offer-docs`` (upsert: clave content-addressed) y devuelve ``storage_path``."""
        url = f"{self._base_url}/storage/v1/object/{OFFER_DOCS_BUCKET}/{object_key}"
        headers = {**self._headers, "x-upsert": "true", "Content-Type": content_type}

        @retry(
            retry=retry_if_exception_type((httpx.TransportError, _Retryable)),
            stop=stop_after_attempt(3),
            wait=wait_exponential(multiplier=0.5, max=6),
            reraise=True,
        )
        def _once() -> None:
            response = self._client.post(url, content=raw, headers=headers)
            if response.status_code >= 500:
                raise _Retryable(f"Storage upload {response.status_code} for {object_key}")
            if response.status_code >= 400:
                raise SupabaseStorageError(
                    f"Storage upload {response.status_code} for {object_key}: {response.text[:200]}"
                )

        _once()
        return f"{OFFER_DOCS_BUCKET}/{object_key}"
