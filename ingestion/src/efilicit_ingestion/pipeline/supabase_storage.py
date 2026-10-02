"""Cliente de Supabase Storage para subir RAW inmutable.

Semana 2 Paso 4: usa la API HTTP de Storage con ``httpx`` + ``service_role``
(proceso confiable). No se añade el SDK ``supabase-py``: ``httpx`` ya está
en el stack fijo del proyecto (ADR 006).
"""

from __future__ import annotations

import hashlib
import os

import httpx

from efilicit_ingestion.models import RemoteArtifact
from efilicit_ingestion.pipeline.paths import DEFAULT_RAW_BUCKET, build_raw_storage_path
from efilicit_ingestion.pipeline.types import StoredArtifact


class SupabaseStorageError(Exception):
    """Fallo al subir o hablar con Supabase Storage."""


class SupabaseStorageArtifactStore:
    """Sube bytes RAW al bucket privado ``raw`` vía API HTTP de Storage.

    Usa la clave service_role (solo ingesta confiable — nunca en el navegador).
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
            # Algunas versiones de Storage usan POST; si el método no vale, probar PUT.
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
    """URL de la API Supabase (local por defecto)."""
    return os.environ.get("SUPABASE_URL", "http://127.0.0.1:54321")


# JWT demo público que trae el CLI de Supabase para stacks locales (role=service_role).
# Solo es seguro contra Supabase local; NUNCA usarlo contra un proyecto remoto.
_LOCAL_SUPABASE_SERVICE_ROLE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0."
    "EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
)


def default_service_role_key() -> str | None:
    """Resuelve service_role para ingesta/tests locales de confianza.

    Preferir ``SUPABASE_SERVICE_ROLE_KEY``. Si no hay y la URL es local,
    cae al JWT demo del CLI de Supabase.
    """
    explicit = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if explicit:
        return explicit

    url = default_supabase_url()
    if "127.0.0.1" in url or "localhost" in url:
        return _LOCAL_SUPABASE_SERVICE_ROLE_KEY
    return None
