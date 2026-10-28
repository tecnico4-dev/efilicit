"""Tests de validate RAW + store Supabase Storage (placsp + agregadas + menores)."""

from __future__ import annotations

import hashlib
import uuid
from datetime import date

import httpx
import psycopg
import pytest

from efilicit_ingestion.connectors.placsp import (
    PLACSP_AGREGADAS,
    PLACSP_MENORES,
    PlacspConnector,
)
from efilicit_ingestion.connectors.placsp.fetch import sha256_hex
from efilicit_ingestion.connectors.placsp.urls import (
    monthly_package_filename,
    monthly_package_url,
)
from efilicit_ingestion.models import RemoteArtifact
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
    storage_api_base_url,
)

SOURCE_CODE = "placsp"
AGREGADAS_SOURCE = "placsp_agregadas"
MENORES_SOURCE = "placsp_menores"
FAKE_ZIP = b"PK\x03\x04-efilicit-raw-fixture"


def _artifact() -> RemoteArtifact:
    return RemoteArtifact(
        artifact_key=monthly_package_filename(2026, 9),
        source_url=monthly_package_url(2026, 9),
        content_type="application/zip",
    )


def _agregadas_artifact() -> RemoteArtifact:
    return RemoteArtifact(
        artifact_key=monthly_package_filename(2026, 9, PLACSP_AGREGADAS),
        source_url=monthly_package_url(2026, 9, PLACSP_AGREGADAS),
        content_type="application/zip",
    )


def _menores_artifact() -> RemoteArtifact:
    return RemoteArtifact(
        artifact_key=monthly_package_filename(2026, 9, PLACSP_MENORES),
        source_url=monthly_package_url(2026, 9, PLACSP_MENORES),
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


def test_validate_artifact_agregadas_rejects_non_zip() -> None:
    with pytest.raises(ValueError, match="ZIP"):
        stages.validate_artifact(b"html-error-page", _agregadas_artifact())


def test_validate_artifact_agregadas_accepts_zip_magic() -> None:
    assert stages.validate_artifact(FAKE_ZIP, _agregadas_artifact()) == FAKE_ZIP


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


def test_build_raw_storage_path_agregadas_prefix() -> None:
    storage_path, object_key = build_raw_storage_path(
        AGREGADAS_SOURCE,
        "PlataformasAgregadasSinMenores_202609.zip",
        day="2026/09/15",
    )
    assert object_key == (
        "placsp_agregadas/2026/09/15/PlataformasAgregadasSinMenores_202609.zip"
    )
    assert storage_path == f"raw/{object_key}"


def test_build_raw_storage_path_menores_prefix() -> None:
    storage_path, object_key = build_raw_storage_path(
        MENORES_SOURCE,
        "contratosMenoresPerfilesContratantes_202609.zip",
        day="2026/09/17",
    )
    assert object_key == (
        "placsp_menores/2026/09/17/contratosMenoresPerfilesContratantes_202609.zip"
    )
    assert storage_path == f"raw/{object_key}"


def test_validate_artifact_menores_rejects_non_zip() -> None:
    with pytest.raises(ValueError, match="ZIP"):
        stages.validate_artifact(b"html-error-page", _menores_artifact())


def test_validate_artifact_menores_accepts_zip_magic() -> None:
    assert stages.validate_artifact(FAKE_ZIP, _menores_artifact()) == FAKE_ZIP


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


def test_supabase_storage_upload_agregadas_prefix_with_mock_http() -> None:
    uploaded_urls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        uploaded_urls.append(str(request.url))
        assert "/storage/v1/object/raw/placsp_agregadas/" in str(request.url)
        assert "PlataformasAgregadasSinMenores_202609.zip" in str(request.url)
        return httpx.Response(200, json={"ok": True})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    store = SupabaseStorageArtifactStore(
        base_url="http://storage.test",
        service_role_key="test-service-role",
        http_client=client,
    )
    stored = store.store(
        source_code=AGREGADAS_SOURCE,
        artifact=_agregadas_artifact(),
        raw=FAKE_ZIP,
    )
    client.close()

    assert stored.storage_path.startswith("raw/placsp_agregadas/")
    assert stored.artifact_key == "PlataformasAgregadasSinMenores_202609.zip"
    assert stored.checksum == sha256_hex(FAKE_ZIP)
    assert len(uploaded_urls) == 1


def test_supabase_storage_upload_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        _ = request
        return httpx.Response(500, text="boom")

    client = httpx.Client(transport=httpx.MockTransport(handler))
    store = SupabaseStorageArtifactStore(
        base_url="http://storage.test",
        service_role_key="test-service-role",
        http_client=client,
        retry_attempts=2,
    )
    with pytest.raises(SupabaseStorageError):
        store.store(source_code=SOURCE_CODE, artifact=_artifact(), raw=FAKE_ZIP)
    client.close()


def test_storage_api_base_url_prefers_direct_host() -> None:
    assert (
        storage_api_base_url("https://abcd1234.supabase.co")
        == "https://abcd1234.storage.supabase.co"
    )
    assert storage_api_base_url("http://127.0.0.1:54321") == "http://127.0.0.1:54321"
    assert (
        storage_api_base_url("https://abcd1234.storage.supabase.co")
        == "https://abcd1234.storage.supabase.co"
    )


def test_supabase_storage_upload_retries_then_succeeds() -> None:
    attempts = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        attempts["n"] += 1
        if attempts["n"] < 2:
            return httpx.Response(503, text="temporary")
        return httpx.Response(200, json={"ok": True})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    store = SupabaseStorageArtifactStore(
        base_url="http://storage.test",
        service_role_key="test-service-role",
        http_client=client,
        retry_attempts=3,
    )
    stored = store.store(source_code=SOURCE_CODE, artifact=_artifact(), raw=FAKE_ZIP)
    client.close()
    assert stored.checksum == sha256_hex(FAKE_ZIP)
    assert attempts["n"] == 2


def test_supabase_storage_tus_upload_with_mock_http() -> None:
    """Umbral bajo fuerza TUS; payload pequeño evita generar 6 MiB en test."""
    patches: list[bytes] = []
    offsets_seen: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if request.method == "POST" and "/storage/v1/upload/resumable" in url:
            assert request.headers.get("tus-resumable") == "1.0.0"
            assert "Upload-Length" in request.headers or "upload-length" in {
                k.lower() for k in request.headers
            }
            return httpx.Response(
                201,
                headers={"Location": "http://storage.test/storage/v1/upload/resumable/abc"},
            )
        if request.method == "PATCH":
            offsets_seen.append(int(request.headers["upload-offset"]))
            patches.append(request.content)
            new_offset = int(request.headers["upload-offset"]) + len(request.content)
            return httpx.Response(204, headers={"Upload-Offset": str(new_offset)})
        return httpx.Response(500, text=f"unexpected {request.method} {url}")

    payload = b"PK\x03\x04" + b"x" * 40
    client = httpx.Client(transport=httpx.MockTransport(handler))
    store = SupabaseStorageArtifactStore(
        base_url="http://storage.test",
        service_role_key="test-service-role",
        http_client=client,
        resumable_threshold_bytes=16,
        tus_chunk_size=16,
    )
    stored = store.store(source_code=SOURCE_CODE, artifact=_artifact(), raw=payload)
    client.close()

    assert stored.byte_size == len(payload)
    assert stored.checksum == sha256_hex(payload)
    assert b"".join(patches) == payload
    assert offsets_seen[0] == 0
    assert sum(len(p) for p in patches) == len(payload)


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


def test_fetch_validate_and_store_raw_agregadas_without_network() -> None:
    """Paso 4.1 for placsp_agregadas: validate ZIP + store under raw/placsp_agregadas/."""
    uploaded: dict[str, bytes] = {}

    def storage_handler(request: httpx.Request) -> httpx.Response:
        assert "/storage/v1/object/raw/placsp_agregadas/" in str(request.url)
        uploaded[str(request.url)] = request.content
        return httpx.Response(200, json={"ok": True})

    def fetch_transport(url: str) -> tuple[int, dict[str, str], bytes]:
        assert "sindicacion_1044" in url
        assert url.endswith("PlataformasAgregadasSinMenores_202609.zip")
        return 200, {"content-type": "application/zip"}, FAKE_ZIP

    http = httpx.Client(transport=httpx.MockTransport(storage_handler))
    store = SupabaseStorageArtifactStore(
        base_url="http://storage.test",
        service_role_key="test-service-role",
        http_client=http,
    )
    connector = PlacspConnector(
        syndication=PLACSP_AGREGADAS,
        as_of=date(2026, 9, 15),
        fetch_transport=fetch_transport,
    )

    stored = fetch_validate_and_store_raw(
        connector,
        _agregadas_artifact(),
        artifact_store=store,
    )
    http.close()

    assert connector.source_code == AGREGADAS_SOURCE
    assert stored.checksum == sha256_hex(FAKE_ZIP)
    assert stored.storage_path.startswith("raw/placsp_agregadas/")
    assert stored.artifact_key == "PlataformasAgregadasSinMenores_202609.zip"
    assert FAKE_ZIP in uploaded.values()


def test_fetch_validate_and_store_raw_agregadas_rejects_bad_payload() -> None:
    def fetch_transport(url: str) -> tuple[int, dict[str, str], bytes]:
        _ = url
        return 200, {"content-type": "application/zip"}, b"not-zip"

    http = httpx.Client(
        transport=httpx.MockTransport(lambda r: httpx.Response(200)),
    )
    connector = PlacspConnector(
        syndication=PLACSP_AGREGADAS,
        fetch_transport=fetch_transport,
    )
    store = SupabaseStorageArtifactStore(
        base_url="http://storage.test",
        service_role_key="test-service-role",
        http_client=http,
    )
    with pytest.raises(ValueError, match="ZIP"):
        fetch_validate_and_store_raw(
            connector,
            _agregadas_artifact(),
            artifact_store=store,
        )
    http.close()


def test_fetch_validate_and_store_raw_menores_without_network() -> None:
    """Paso 2.3: validate ZIP + store under raw/placsp_menores/."""
    uploaded: dict[str, bytes] = {}

    def storage_handler(request: httpx.Request) -> httpx.Response:
        assert "/storage/v1/object/raw/placsp_menores/" in str(request.url)
        uploaded[str(request.url)] = request.content
        return httpx.Response(200, json={"ok": True})

    def fetch_transport(url: str) -> tuple[int, dict[str, str], bytes]:
        assert "sindicacion_1143" in url
        assert url.endswith("contratosMenoresPerfilesContratantes_202609.zip")
        return 200, {"content-type": "application/zip"}, FAKE_ZIP

    http = httpx.Client(transport=httpx.MockTransport(storage_handler))
    store = SupabaseStorageArtifactStore(
        base_url="http://storage.test",
        service_role_key="test-service-role",
        http_client=http,
    )
    connector = PlacspConnector(
        syndication=PLACSP_MENORES,
        as_of=date(2026, 9, 17),
        fetch_transport=fetch_transport,
    )

    stored = fetch_validate_and_store_raw(
        connector,
        _menores_artifact(),
        artifact_store=store,
    )
    http.close()

    assert connector.source_code == MENORES_SOURCE
    assert stored.checksum == sha256_hex(FAKE_ZIP)
    assert stored.storage_path.startswith("raw/placsp_menores/")
    assert stored.artifact_key == "contratosMenoresPerfilesContratantes_202609.zip"
    assert FAKE_ZIP in uploaded.values()


def test_fetch_validate_and_store_raw_menores_rejects_bad_payload() -> None:
    def fetch_transport(url: str) -> tuple[int, dict[str, str], bytes]:
        _ = url
        return 200, {"content-type": "application/zip"}, b"not-zip"

    http = httpx.Client(
        transport=httpx.MockTransport(lambda r: httpx.Response(200)),
    )
    connector = PlacspConnector(
        syndication=PLACSP_MENORES,
        fetch_transport=fetch_transport,
    )
    store = SupabaseStorageArtifactStore(
        base_url="http://storage.test",
        service_role_key="test-service-role",
        http_client=http,
    )
    with pytest.raises(ValueError, match="ZIP"):
        fetch_validate_and_store_raw(
            connector,
            _menores_artifact(),
            artifact_store=store,
        )
    http.close()


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


@pytest.mark.skipif(
    _live_raw_skip_reason() is not None,
    reason=_live_raw_skip_reason() or "live Supabase unavailable",
)
def test_placsp_agregadas_fetch_stores_raw_and_registers_source_artifact() -> None:
    """Live local: placsp_agregadas RAW under prefix + source_artifacts row."""
    run_id = f"raw-agregadas-itest-{uuid.uuid4()}"
    key = default_service_role_key()
    assert key is not None

    def fetch_transport(url: str) -> tuple[int, dict[str, str], bytes]:
        assert "sindicacion_1044" in url
        return 200, {"content-type": "application/zip"}, FAKE_ZIP

    connector = PlacspConnector(
        syndication=PLACSP_AGREGADAS,
        as_of=date(2026, 9, 15),
        fetch_transport=fetch_transport,
    )
    store = SupabaseStorageArtifactStore(
        base_url=default_supabase_url(),
        service_role_key=key,
    )

    with connect() as conn:
        sync_repo = PostgresSyncRepository(conn)
        run = sync_repo.start_run(
            source_code=AGREGADAS_SOURCE,
            run_id=run_id,
            cursor=None,
        )
        stored = fetch_validate_and_store_raw(
            connector,
            _agregadas_artifact(),
            artifact_store=store,
        )
        sync_repo.register_artifact(run, stored)
        sync_repo.finish_run(run, status="success")
        conn.commit()

        assert stored.storage_path.startswith("raw/placsp_agregadas/")
        row = conn.execute(
            """
            select storage_path, checksum, byte_size
            from public.source_artifacts
            where source_code = %s and artifact_key = %s
            """,
            (AGREGADAS_SOURCE, stored.artifact_key),
        ).fetchone()
        assert row is not None
        assert row[0] == stored.storage_path
        assert row[1] == stored.checksum

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
            (AGREGADAS_SOURCE, stored.artifact_key),
        )
        conn.execute(
            "delete from public.source_sync where source_code = %s and run_id = %s",
            (AGREGADAS_SOURCE, run_id),
        )
        conn.commit()


def test_default_database_url_still_local() -> None:
    assert "54322" in default_database_url()
