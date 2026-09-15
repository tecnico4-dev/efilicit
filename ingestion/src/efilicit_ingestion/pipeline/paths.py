"""RAW Storage path convention (bucket + object key)."""

from __future__ import annotations

from efilicit_ingestion.pipeline.types import utc_now

DEFAULT_RAW_BUCKET = "raw"


def build_raw_object_key(source_code: str, artifact_key: str, *, day: str | None = None) -> str:
    """Path inside the ``raw`` bucket: ``{source}/{yyyy}/{mm}/{dd}/{artifact_key}``."""
    day_path = day or utc_now().strftime("%Y/%m/%d")
    return f"{source_code}/{day_path}/{artifact_key}"


def build_raw_storage_path(
    source_code: str,
    artifact_key: str,
    *,
    bucket: str = DEFAULT_RAW_BUCKET,
    day: str | None = None,
) -> tuple[str, str]:
    """Return ``(storage_path, object_key)``.

    ``storage_path`` is the logical path stored in ``source_artifacts``
    (``raw/placsp/2026/09/11/file.zip``).
    ``object_key`` is the key inside the Storage bucket (without bucket prefix).
    """
    object_key = build_raw_object_key(source_code, artifact_key, day=day)
    storage_path = f"{bucket}/{object_key}"
    return storage_path, object_key
