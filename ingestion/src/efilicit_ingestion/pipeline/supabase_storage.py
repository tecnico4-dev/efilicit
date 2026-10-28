"""Cliente de Supabase Storage para subir RAW inmutable (Semana 2 Paso 4).

Habla a la API HTTP de Storage con ``httpx`` + ``service_role`` (proceso
confiable). No se añade ``supabase-py``: ``httpx`` ya está en el stack fijo
(ADR 006). El bucket ``raw`` es privado; la web no usa esta clave.

Payloads grandes (≥ umbral, default 6 MiB) usan TUS resumable (ADR 021)
sin partir el artefacto: un solo objeto final en Storage.
"""

from __future__ import annotations

import base64
import hashlib
import os
import re
from collections.abc import Callable, Iterator
from urllib.parse import urlparse

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from efilicit_ingestion.models import RemoteArtifact
from efilicit_ingestion.pipeline.paths import DEFAULT_RAW_BUCKET, build_raw_storage_path
from efilicit_ingestion.pipeline.types import StoredArtifact

# Supabase exige chunk TUS de 6 MiB (no cambiar).
TUS_CHUNK_SIZE = 6 * 1024 * 1024
DEFAULT_RESUMABLE_THRESHOLD_BYTES = TUS_CHUNK_SIZE
DEFAULT_UPLOAD_TIMEOUT_SECONDS = 600.0
DEFAULT_UPLOAD_RETRY_ATTEMPTS = 4
TUS_RESUMABLE_VERSION = "1.0.0"


class SupabaseStorageError(Exception):
    """Fallo al subir o hablar con Supabase Storage."""


class _RetryableStorageHttpError(SupabaseStorageError):
    """5xx / transporte lógico reintentable en upload."""


def storage_api_base_url(base_url: str) -> str:
    """Prefiere el hostname directo ``*.storage.supabase.co`` en proyectos cloud.

    Localhost / URLs de test se dejan igual. Ver docs Supabase resumable uploads.
    """
    raw = base_url.rstrip("/")
    parsed = urlparse(raw)
    host = (parsed.hostname or "").lower()
    if not host or host in {"127.0.0.1", "localhost"} or "storage.supabase.co" in host:
        return raw
    match = re.fullmatch(
        r"([a-z0-9-]+)\.supabase\.co",
        host,
    )
    if match is None:
        return raw
    ref = match.group(1)
    scheme = parsed.scheme or "https"
    return f"{scheme}://{ref}.storage.supabase.co"


def _b64_meta(value: str) -> str:
    return base64.b64encode(value.encode("utf-8")).decode("ascii")


def _tus_upload_metadata(
    *,
    bucket: str,
    object_name: str,
    content_type: str,
) -> str:
    parts = [
        f"bucketName {_b64_meta(bucket)}",
        f"objectName {_b64_meta(object_name)}",
        f"contentType {_b64_meta(content_type)}",
    ]
    return ",".join(parts)


def _iter_chunks(raw: bytes, chunk_size: int) -> Iterator[bytes]:
    for start in range(0, len(raw), chunk_size):
        yield raw[start : start + chunk_size]


class SupabaseStorageArtifactStore:
    """Sube bytes RAW al bucket privado ``raw`` vía API HTTP de Storage.

    Idempotencia blanda: ``x-upsert`` permite reescribir el mismo object key
    si se reejecuta el mismo artefacto (el checksum queda en metadata/DB).
    """

    def __init__(
        self,
        *,
        base_url: str,
        service_role_key: str,
        bucket: str = DEFAULT_RAW_BUCKET,
        http_client: httpx.Client | None = None,
        upsert: bool = True,
        timeout_seconds: float = DEFAULT_UPLOAD_TIMEOUT_SECONDS,
        retry_attempts: int = DEFAULT_UPLOAD_RETRY_ATTEMPTS,
        resumable_threshold_bytes: int = DEFAULT_RESUMABLE_THRESHOLD_BYTES,
        tus_chunk_size: int = TUS_CHUNK_SIZE,
    ) -> None:
        if not base_url:
            raise ValueError("base_url is required")
        if not service_role_key:
            raise ValueError("service_role_key is required")
        if timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be positive")
        if retry_attempts < 1:
            raise ValueError("retry_attempts must be >= 1")
        if resumable_threshold_bytes < 1:
            raise ValueError("resumable_threshold_bytes must be >= 1")
        if tus_chunk_size < 1:
            raise ValueError("tus_chunk_size must be >= 1")
        self._base_url = storage_api_base_url(base_url)
        self._service_role_key = service_role_key
        self._bucket = bucket
        self._client = http_client
        self._upsert = upsert
        self._timeout_seconds = timeout_seconds
        self._retry_attempts = retry_attempts
        self._resumable_threshold_bytes = resumable_threshold_bytes
        self._tus_chunk_size = tus_chunk_size

    def store(
        self,
        *,
        source_code: str,
        artifact: RemoteArtifact,
        raw: bytes,
    ) -> StoredArtifact:
        """Sube el payload y devuelve checksum + ruta lógica para ``source_artifacts``."""
        checksum = hashlib.sha256(raw).hexdigest()
        storage_path, object_key = build_raw_storage_path(
            source_code,
            artifact.artifact_key,
            bucket=self._bucket,
        )
        content_type = artifact.content_type or "application/octet-stream"
        if len(raw) >= self._resumable_threshold_bytes:
            self._upload_resumable_tus(
                object_key=object_key,
                raw=raw,
                content_type=content_type,
            )
        else:
            self._upload_simple(
                object_key=object_key,
                raw=raw,
                content_type=content_type,
            )
        return StoredArtifact(
            artifact_key=artifact.artifact_key,
            checksum=checksum,
            storage_path=storage_path,
            byte_size=len(raw),
            content_type=artifact.content_type,
            source_url=artifact.source_url,
        )

    def _auth_headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._service_role_key}",
            "apikey": self._service_role_key,
        }

    def _with_client(self, fn: Callable[[httpx.Client], None]) -> None:
        if self._client is not None:
            fn(self._client)
            return
        timeout = httpx.Timeout(
            connect=30.0,
            read=self._timeout_seconds,
            write=self._timeout_seconds,
            pool=30.0,
        )
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            fn(client)

    def _upload_simple(
        self,
        *,
        object_key: str,
        raw: bytes,
        content_type: str,
    ) -> None:
        url = f"{self._base_url}/storage/v1/object/{self._bucket}/{object_key}"
        headers = {
            **self._auth_headers(),
            "x-upsert": "true" if self._upsert else "false",
            "Content-Type": content_type,
        }

        @retry(
            retry=retry_if_exception_type(
                (httpx.TransportError, httpx.TimeoutException, _RetryableStorageHttpError)
            ),
            stop=stop_after_attempt(self._retry_attempts),
            wait=wait_exponential(multiplier=0.5, min=0.5, max=8),
            reraise=True,
        )
        def _once(client: httpx.Client) -> None:
            response = client.post(url, content=raw, headers=headers)
            if response.status_code in {404, 405}:
                response = client.put(url, content=raw, headers=headers)
            if response.status_code >= 500:
                raise _RetryableStorageHttpError(
                    f"Storage upload failed ({response.status_code}) for "
                    f"{self._bucket}/{object_key}: {response.text[:300]}"
                )
            if response.status_code >= 400:
                raise SupabaseStorageError(
                    f"Storage upload failed ({response.status_code}) for "
                    f"{self._bucket}/{object_key}: {response.text[:300]}"
                )

        try:
            self._with_client(_once)
        except _RetryableStorageHttpError as exc:
            raise SupabaseStorageError(str(exc)) from exc
        except httpx.TimeoutException as exc:
            raise SupabaseStorageError(
                f"timeout uploading {self._bucket}/{object_key}"
            ) from exc
        except httpx.TransportError as exc:
            raise SupabaseStorageError(
                f"transport error uploading {self._bucket}/{object_key}: {exc}"
            ) from exc

    def _upload_resumable_tus(
        self,
        *,
        object_key: str,
        raw: bytes,
        content_type: str,
    ) -> None:
        create_url = f"{self._base_url}/storage/v1/upload/resumable"
        meta = _tus_upload_metadata(
            bucket=self._bucket,
            object_name=object_key,
            content_type=content_type,
        )
        create_headers = {
            **self._auth_headers(),
            "Tus-Resumable": TUS_RESUMABLE_VERSION,
            "Upload-Length": str(len(raw)),
            "Upload-Metadata": meta,
            "x-upsert": "true" if self._upsert else "false",
        }

        @retry(
            retry=retry_if_exception_type(
                (httpx.TransportError, httpx.TimeoutException, _RetryableStorageHttpError)
            ),
            stop=stop_after_attempt(self._retry_attempts),
            wait=wait_exponential(multiplier=0.5, min=0.5, max=8),
            reraise=True,
        )
        def _create(client: httpx.Client) -> str:
            response = client.post(create_url, headers=create_headers)
            if response.status_code >= 500:
                raise _RetryableStorageHttpError(
                    f"TUS create failed ({response.status_code}): {response.text[:300]}"
                )
            if response.status_code not in {201, 200}:
                raise SupabaseStorageError(
                    f"TUS create failed ({response.status_code}) for "
                    f"{self._bucket}/{object_key}: {response.text[:300]}"
                )
            location = response.headers.get("Location") or response.headers.get("location")
            if not location:
                raise SupabaseStorageError(
                    f"TUS create missing Location for {self._bucket}/{object_key}"
                )
            if location.startswith("/"):
                parsed = urlparse(self._base_url)
                location = f"{parsed.scheme}://{parsed.netloc}{location}"
            return location

        def _patch_chunk(
            client: httpx.Client,
            *,
            upload_url: str,
            offset: int,
            chunk: bytes,
        ) -> int:
            @retry(
                retry=retry_if_exception_type(
                    (
                        httpx.TransportError,
                        httpx.TimeoutException,
                        _RetryableStorageHttpError,
                    )
                ),
                stop=stop_after_attempt(self._retry_attempts),
                wait=wait_exponential(multiplier=0.5, min=0.5, max=8),
                reraise=True,
            )
            def _once() -> int:
                headers = {
                    **self._auth_headers(),
                    "Tus-Resumable": TUS_RESUMABLE_VERSION,
                    "Upload-Offset": str(offset),
                    "Content-Type": "application/offset+octet-stream",
                    "Content-Length": str(len(chunk)),
                }
                response = client.patch(upload_url, content=chunk, headers=headers)
                if response.status_code >= 500:
                    raise _RetryableStorageHttpError(
                        f"TUS PATCH failed ({response.status_code}) at offset "
                        f"{offset}: {response.text[:300]}"
                    )
                if response.status_code not in {204, 200}:
                    raise SupabaseStorageError(
                        f"TUS PATCH failed ({response.status_code}) at offset "
                        f"{offset} for {self._bucket}/{object_key}: "
                        f"{response.text[:300]}"
                    )
                new_offset_raw = response.headers.get("Upload-Offset") or response.headers.get(
                    "upload-offset"
                )
                if new_offset_raw is None:
                    return offset + len(chunk)
                try:
                    return int(new_offset_raw)
                except ValueError as exc:
                    raise SupabaseStorageError(
                        f"TUS PATCH invalid Upload-Offset {new_offset_raw!r}"
                    ) from exc

            return _once()

        def _run(client: httpx.Client) -> None:
            try:
                upload_url = _create(client)
            except _RetryableStorageHttpError as exc:
                raise SupabaseStorageError(str(exc)) from exc

            offset = 0
            for chunk in _iter_chunks(raw, self._tus_chunk_size):
                try:
                    offset = _patch_chunk(
                        client,
                        upload_url=upload_url,
                        offset=offset,
                        chunk=chunk,
                    )
                except _RetryableStorageHttpError as exc:
                    raise SupabaseStorageError(str(exc)) from exc
            if offset != len(raw):
                raise SupabaseStorageError(
                    f"TUS incomplete upload for {self._bucket}/{object_key}: "
                    f"offset={offset} expected={len(raw)}"
                )

        try:
            self._with_client(_run)
        except SupabaseStorageError:
            raise
        except httpx.TimeoutException as exc:
            raise SupabaseStorageError(
                f"timeout TUS uploading {self._bucket}/{object_key}"
            ) from exc
        except httpx.TransportError as exc:
            raise SupabaseStorageError(
                f"transport error TUS uploading {self._bucket}/{object_key}: {exc}"
            ) from exc


def default_supabase_url() -> str:
    """URL de la API Supabase (local por defecto en dev)."""
    return os.environ.get("SUPABASE_URL", "http://127.0.0.1:54321")


# JWT demo público del CLI de Supabase para stacks locales (role=service_role).
# Solo es seguro contra Supabase local; NUNCA usarlo contra un proyecto remoto.
_LOCAL_SUPABASE_SERVICE_ROLE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0."
    "EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
)


def default_service_role_key() -> str | None:
    """Resuelve service_role para ingesta/tests locales de confianza.

    Preferir ``SUPABASE_SERVICE_ROLE_KEY``. Si no hay y la URL es local,
    cae al JWT demo del CLI (comodidad en laptop; no en prod).
    """
    explicit = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if explicit:
        return explicit

    url = default_supabase_url()
    if "127.0.0.1" in url or "localhost" in url:
        return _LOCAL_SUPABASE_SERVICE_ROLE_KEY
    return None
