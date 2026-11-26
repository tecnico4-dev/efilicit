"""Convención de rutas RAW en Storage (bucket + object key).

Layout content-addressed (ADR 033): ``raw/{source_code}/{artifact_key}``.
Sin carpeta de día de subida: el mismo checksum reescribe la misma clave
(``x-upsert``) y no multiplica huérfanos en reintentos.
"""

from __future__ import annotations

DEFAULT_RAW_BUCKET = "raw"


def build_raw_object_key(source_code: str, artifact_key: str) -> str:
    """Clave dentro del bucket ``raw`` (sin prefijo de bucket)."""
    return f"{source_code}/{artifact_key}"


def build_raw_storage_path(
    source_code: str,
    artifact_key: str,
    *,
    bucket: str = DEFAULT_RAW_BUCKET,
) -> tuple[str, str]:
    """Devuelve ``(storage_path, object_key)``.

    ``storage_path`` es lo que guardamos en ``source_artifacts``
    (p. ej. ``raw/placsp/entries/{sha256}.atom.xml``).
    ``object_key`` es lo que pide la API de Storage (sin el nombre del bucket).
    """
    object_key = build_raw_object_key(source_code, artifact_key)
    storage_path = f"{bucket}/{object_key}"
    return storage_path, object_key
