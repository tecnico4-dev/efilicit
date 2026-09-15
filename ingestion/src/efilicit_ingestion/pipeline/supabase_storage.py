"""Supabase Storage ArtifactStore for immutable RAW uploads."""

from __future__ import annotations

import hashlib
import os

import httpx

from efilicit_ingestion.models import RemoteArtifact
from efilicit_ingestion.pipeline.paths import DEFAULT_RAW_BUCKET, build_raw_storage_path
from efilicit_ingestion.pipeline.types import StoredArtifact


class SupabaseStorageError(Exception):
    """Failed to upload or talk to Supabase Storage."""


class SupabaseStorageArtifactStore:
    """Uploads RAW bytes to the private ``raw`` bucket via Storage HTTP API.

    Uses the service role key (trusted ingestion only — never in the browser).
    """

    def __init__(
        self,
        *,
        base_url: str,
        service_role_key: str,
        bucket: str = DEFAULT_RAW_BUCKET,
        http_client: httpx.Client | None = None,
        upsert: bool = True,
    ) -> None:
        if not base_url:
            raise ValueError("base_url is required")
        if not service_role_key:
            raise ValueError("service_role_key is required")
        self._base_url = base_url.rstrip("/")
        self._service_role_key = service_role_key
        self._bucket = bucket
        self._client = http_client
        self._upsert = upsert

    def store(
        self,
        *,
        source_code: str,
        artifact: RemoteArtifact,
        raw: bytes,
    ) -> StoredArtifact:
        checksum = hashlib.sha256(raw).hexdigest()
        storage_path, object_key = build_raw_storage_path(
            source_code,
            artifact.artifact_key,
            bucket=self._bucket,
        )
        self._upload(object_key=object_key, raw=raw, content_type=artifact.content_type)
        return StoredArtifact(
            artifact_key=artifact.artifact_key,
            checksum=checksum,
            storage_path=storage_path,
            byte_size=len(raw),
            content_type=artifact.content_type,
            source_url=artifact.source_url,
        )

    def _upload(
        self,
        *,
        object_key: str,
        raw: bytes,
        content_type: str | None,
    ) -> None:
        url = f"{self._base_url}/storage/v1/object/{self._bucket}/{object_key}"
        headers = {
            "Authorization": f"Bearer {self._service_role_key}",
            "apikey": self._service_role_key,
            "x-upsert": "true" if self._upsert else "false",
            "Content-Type": content_type or "application/octet-stream",
        }

        def _put(client: httpx.Client) -> None:
            response = client.post(url, content=raw, headers=headers)
            # Some Storage versions use POST; if method not allowed, try PUT.
            if response.status_code in {404, 405}:
                response = client.put(url, content=raw, headers=headers)
            if response.status_code >= 400:
                raise SupabaseStorageError(
                    f"Storage upload failed ({response.status_code}) for "
                    f"{self._bucket}/{object_key}: {response.text[:300]}"
                )

        if self._client is not None:
            _put(self._client)
            return

        with httpx.Client(timeout=60.0, follow_redirects=True) as client:
            _put(client)


def default_supabase_url() -> str:
    return os.environ.get("SUPABASE_URL", "http://127.0.0.1:54321")


# Public demo JWT shipped by Supabase CLI for local stacks (role=service_role).
# Safe only against local Supabase; never use against a remote project.
_LOCAL_SUPABASE_SERVICE_ROLE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0."
    "EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
)


def default_service_role_key() -> str | None:
    """Resolve service_role for trusted local ingestion/tests.

    Prefer ``SUPABASE_SERVICE_ROLE_KEY``. If unset and the API URL is local,
    fall back to the Supabase CLI demo service_role JWT.
    """
    explicit = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if explicit:
        return explicit

    url = default_supabase_url()
    if "127.0.0.1" in url or "localhost" in url:
        return _LOCAL_SUPABASE_SERVICE_ROLE_KEY
    return None
