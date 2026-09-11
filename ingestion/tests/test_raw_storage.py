"""Tests for RAW validate + Supabase Storage store (Semana 2 Paso 4)."""

from __future__ import annotations

import hashlib
import uuid
from datetime import date

import httpx
import psycopg
import pytest

from efilicit_ingestion.connectors.placsp import PlacspConnector
from efilicit_ingestion.connectors.placsp.fetch import sha256_hex
from efilicit_ingestion.connectors.placsp.urls import (
    monthly_package_filename,
    monthly_package_url,
)
from efilicit_ingestion.models import RemoteArtifact, SyncContext
from efilicit_ingestion.pipeline import stages
from efilicit_ingestion.pipeline.paths import build_raw_storage_path
from efilicit_ingestion.pipeline.postgres import (
    PostgresSyncRepository,
    connect,
    default_database_url,
)
from efilicit_ingestion.pipeline.raw import fetch_validate_and_store_raw
from efilicit_ingestion.pipeline.supabase_storage import (
    SupabaseStorageArtifactStore,
    SupabaseStorageError,
    default_service_role_key,
    default_supabase_url,
)

SOURCE_CODE = "placsp"
FAKE_ZIP = b"PK\x03\x04-efilicit-raw-fixture"


def _artifact() -> RemoteArtifact:
    return RemoteArtifact(
        artifact_key=monthly_package_filename(2026, 9),
        source_url=monthly_package_url(2026, 9),
        content_type="application/zip",
    )


def test_validate_artifact_rejects_empty() -> None:
    with pytest.raises(ValueError, match="empty"):
        stages.validate_artifact(b"", _artifact())


def test_validate_artifact_rejects_non_zip_payload() -> None:
    with pytest.raises(ValueError, match="ZIP"):
        stages.validate_artifact(b"not-a-zip", _artifact())


def test_validate_artifact_accepts_zip_magic() -> None:
    assert stages.validate_artifact(FAKE_ZIP, _artifact()) == FAKE_ZIP


def test_build_raw_storage_path_convention() -> None:
    storage_path, object_key = build_raw_storage_path(
        "placsp",
        "licitacionesPerfilesContratanteCompleto3_202609.zip",
        day="2026/09/11",
    )
    assert object_key == (
        "placsp/2026/09/11/licitacionesPerfilesContratanteCompleto3_202609.zip"
    )
    assert storage_path == f"raw/{object_key}"


def test_supabase_storage_upload_with_mock_http() -> None:
    uploaded: dict[str, bytes] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method in {"POST", "PUT"}
        assert "/storage/v1/object/raw/placsp/" in str(request.url)
        assert request.headers.get("authorization", "").startswith("Bearer ")
        uploaded[str(request.url)] = request.content
        return httpx.Response(200, json={"Key": "raw/placsp/..."})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    store = SupabaseStorageArtifactStore(
        base_url="http://storage.test",
        service_role_key="test-service-role",
        http_client=client,
    )
    stored = store.store(source_code=SOURCE_CODE, artifact=_artifact(), raw=FAKE_ZIP)
    client.close()

    assert stored.byte_size == len(FAKE_ZIP)
    assert stored.checksum == sha256_hex(FAKE_ZIP)
    assert stored.storage_path.startswith("raw/placsp/")
    assert stored.artifact_key.endswith("202609.zip")
    assert len(uploaded) == 1
    assert next(iter(uploaded.values())) == FAKE_ZIP


def test_supabase_storage_upload_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        _ = request
        return httpx.Response(500, text="boom")

    client = httpx.Client(transport=httpx.MockTransport(handler))
    store = SupabaseStorageArtifactStore(
        base_url="http://storage.test",
        service_role_key="test-service-role",
        http_client=client,
    )
    with pytest.raises(SupabaseStorageError):
        store.store(source_code=SOURCE_CODE, artifact=_artifact(), raw=FAKE_ZIP)
    client.close()


def test_fetch_validate_and_store_raw_roundtrip_memory_style() -> None:
    """Offline end-to-end of Paso 4 without live Supabase (mock Storage HTTP)."""
    uploaded: dict[str, bytes] = {}

    def storage_handler(request: httpx.Request) -> httpx.Response:
        uploaded[str(request.url)] = request.content
        return httpx.Response(200, json={"ok": True})

    def fetch_transport(url: str) -> tuple[int, dict[str, str], bytes]:
        assert "202609.zip" in url
        return 200, {"content-type": "application/zip"}, FAKE_ZIP

    http = httpx.Client(transport=httpx.MockTransport(storage_handler))
    store = SupabaseStorageArtifactStore(
        base_url="http://storage.test",
        service_role_key="test-service-role",
        http_client=http,
    )
    connector = PlacspConnector(
        as_of=date(2026, 9, 11),
        fetch_transport=fetch_transport,
    )

    stored = fetch_validate_and_store_raw(
        connector,
        _artifact(),
        artifact_store=store,
    )
    http.close()

    assert stored.checksum == hashlib.sha256(FAKE_ZIP).hexdigest()
    assert stored.storage_path.startswith("raw/placsp/")
    assert FAKE_ZIP in uploaded.values()


def _db_available() -> bool:
    try:
        with psycopg.connect(
            default_database_url(),
            connect_timeout=2,
        ) as conn:
            conn.execute("select 1")
        return True
    except psycopg.Error:
        return False


def _storage_available() -> bool:
    key = default_service_role_key()
    if not key:
        return False
    try:
        with httpx.Client(timeout=2.0) as client:
            response = client.get(
                f"{default_supabase_url()}/storage/v1/bucket/raw",
                headers={
                    "Authorization": f"Bearer {key}",
                    "apikey": key,
                },
            )
        return response.status_code < 500
    except httpx.HTTPError:
        return False


def _live_raw_skip_reason() -> str | None:
    if not _db_available():
        return "Local Postgres not reachable on 54322 (start Docker + supabase start)"
    if not _storage_available():
        return (
            "Local Storage not reachable or missing service_role "
            "(set SUPABASE_SERVICE_ROLE_KEY from `supabase status`, or use local demo key)"
        )
    return None


@pytest.mark.skipif(
    _live_raw_skip_reason() is not None,
    reason=_live_raw_skip_reason() or "live Supabase unavailable",
)
def test_placsp_fetch_stores_raw_and_registers_source_artifact() -> None:
    """Live local criterion: Storage object + source_artifacts row."""
    run_id = f"raw-itest-{uuid.uuid4()}"
    key = default_service_role_key()
    assert key is not None

    def fetch_transport(url: str) -> tuple[int, dict[str, str], bytes]:
        _ = url
        return 200, {"content-type": "application/zip"}, FAKE_ZIP

    connector = PlacspConnector(as_of=date(2026, 9, 11), fetch_transport=fetch_transport)
    store = SupabaseStorageArtifactStore(
        base_url=default_supabase_url(),
        service_role_key=key,
    )

    with connect() as conn:
        sync_repo = PostgresSyncRepository(conn)
        run = sync_repo.start_run(
            source_code=SOURCE_CODE,
            run_id=run_id,
            cursor=None,
        )
        stored = fetch_validate_and_store_raw(
            connector,
            _artifact(),
            artifact_store=store,
        )
        sync_repo.register_artifact(run, stored)
        sync_repo.finish_run(run, status="success")
        conn.commit()

        row = conn.execute(
            """
            select storage_path, checksum, byte_size
            from public.source_artifacts
            where source_code = %s and artifact_key = %s
            """,
            (SOURCE_CODE, stored.artifact_key),
        ).fetchone()
        assert row is not None
        assert row[0] == stored.storage_path
        assert row[1] == stored.checksum
        assert row[2] == stored.byte_size

        # Object readable back from Storage with service role.
        object_key = stored.storage_path.removeprefix("raw/")
        with httpx.Client(timeout=30.0) as client:
            downloaded = client.get(
                f"{default_supabase_url()}/storage/v1/object/{store._bucket}/{object_key}",
                headers={
                    "Authorization": f"Bearer {key}",
                    "apikey": key,
                },
            )
        assert downloaded.status_code == 200
        assert downloaded.content == FAKE_ZIP

        conn.execute(
            "delete from public.source_artifacts where source_code = %s and artifact_key = %s",
            (SOURCE_CODE, stored.artifact_key),
        )
        conn.execute(
            "delete from public.source_sync where source_code = %s and run_id = %s",
            (SOURCE_CODE, run_id),
        )
        conn.commit()


def test_default_database_url_still_local() -> None:
    assert "54322" in default_database_url()
