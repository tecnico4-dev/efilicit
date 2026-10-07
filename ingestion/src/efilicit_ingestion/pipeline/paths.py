"""Convención de rutas RAW en Storage (bucket + object key).

Un solo layout para todas las fuentes: ``raw/{source_code}/{yyyy}/{mm}/{dd}/{artifact_key}``.
La fecha es la del día de subida (no el mes del ZIP PLACSP): facilita listar
evidencias por corrida; el mes del paquete vive en el ``artifact_key``.
"""

from __future__ import annotations

from efilicit_ingestion.pipeline.types import utc_now

DEFAULT_RAW_BUCKET = "raw"


def build_raw_object_key(source_code: str, artifact_key: str, *, day: str | None = None) -> str:
    """Clave dentro del bucket ``raw`` (sin prefijo de bucket)."""
    day_path = day or utc_now().strftime("%Y/%m/%d")
    return f"{source_code}/{day_path}/{artifact_key}"


def build_raw_storage_path(
    source_code: str,
    artifact_key: str,
    *,
    bucket: str = DEFAULT_RAW_BUCKET,
    day: str | None = None,
) -> tuple[str, str]:
    """Devuelve ``(storage_path, object_key)``.

    ``storage_path`` es lo que guardamos en ``source_artifacts``
    (p. ej. ``raw/placsp/2026/09/11/….zip``).
    ``object_key`` es lo que pide la API de Storage (sin el nombre del bucket).
    """
    object_key = build_raw_object_key(source_code, artifact_key, day=day)
    storage_path = f"{bucket}/{object_key}"
    return storage_path, object_key
