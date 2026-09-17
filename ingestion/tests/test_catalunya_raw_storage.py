"""RAW validate + Storage for catalunya (Semana 3 Paso 8.2).

Reuses Semana 2 helpers; JSON pages (not ZIP). No live SODA network in unit tests.
"""

from __future__ import annotations

import uuid
from pathlib import Path

import httpx
import psycopg
import pytest

from efilicit_ingestion.connectors.socrata import CATALUNYA, SocrataConnector, sha256_hex
from efilicit_ingestion.connectors.socrata.urls import page_artifact_key, page_resource_url
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
    default_service_role_key,
    default_supabase_url,
)

SOURCE_CODE = "catalunya"
FIXTURE = Path(__file__).parent / "fixtures" / "catalunya" / "valid_page.json"
FAKE_JSON = FIXTURE.read_bytes()


def _catalunya_artifact() -> RemoteArtifact:
    return RemoteArtifact(
        artifact_key=page_artifact_key(CATALUNYA, offset=0, limit=1000),
        source_url=page_resource_url(CATALUNYA, offset=0, limit=1000),
        content_type="application/json",
        metadata={"dataset_id": CATALUNYA.dataset_id, "offset": 0, "limit": 1000},
    )


def test_validate_artifact_catalunya_rejects_empty() -> None:
    with pytest.raises(ValueError, match="empty"):
        stages.validate_artifact(b"", _catalunya_artifact())


def test_validate_artifact_catalunya_accepts_json_page() -> None:
    assert stages.validate_artifact(FAKE_JSON, _catalunya_artifact()) == FAKE_JSON


def test_build_raw_storage_path_catalunya_prefix() -> None:
    key = page_artifact_key(CATALUNYA, offset=0, limit=1000)
    storage_path, object_key = build_raw_storage_path(
        SOURCE_CODE,
        key,
        day="2026/09/16",
    )
    assert object_key == f"catalunya/2026/09/16/{key}"
    assert storage_path == f"raw/{object_key}"


def test_supabase_storage_upload_catalunya_with_mock_http() -> None:
    uploaded: dict[str, bytes] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method in {"POST", "PUT"}
        assert "/storage/v1/object/raw/catalunya/" in str(request.url)
        uploaded[str(request.url)] = request.content
        return httpx.Response(200, json={"Key": "raw/catalunya/..."})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    store = SupabaseStorageArtifactStore(
        base_url="http://storage.test",
        service_role_key="test-service-role",
        http_client=client,
    )
    stored = store.store(
        source_code=SOURCE_CODE,
        artifact=_catalunya_artifact(),
        raw=FAKE_JSON,
    )
    client.close()

    assert stored.storage_path.startswith("raw/catalunya/")
    assert stored.checksum == sha256_hex(FAKE_JSON)
    assert FAKE_JSON in uploaded.values()


def test_fetch_validate_and_store_raw_catalunya_without_network() -> None:
    """Paso 8.2: validate JSON + store under raw/catalunya/."""
    uploaded: dict[str, bytes] = {}

    def storage_handler(request: httpx.Request) -> httpx.Response:
        assert "/storage/v1/object/raw/catalunya/" in str(request.url)
        uploaded[str(request.url)] = request.content
        return httpx.Response(200, json={"ok": True})

    def fetch_transport(url: str) -> tuple[int, dict[str, str], bytes]:
        assert "ybgg-dgi6.json" in url
        assert "$offset=0" in url
        return 200, {"content-type": "application/json"}, FAKE_JSON

    http = httpx.Client(transport=httpx.MockTransport(storage_handler))
    store = SupabaseStorageArtifactStore(
        base_url="http://storage.test",
        service_role_key="test-service-role",
        http_client=http,
    )
    connector = SocrataConnector(
        page_size=1000,
        max_pages=1,
        fetch_transport=fetch_transport,
    )

    stored = fetch_validate_and_store_raw(
        connector,
        _catalunya_artifact(),
        artifact_store=store,
    )
    http.close()

    assert connector.source_code == SOURCE_CODE
    assert stored.checksum == sha256_hex(FAKE_JSON)
    assert stored.storage_path.startswith("raw/catalunya/")
    assert stored.artifact_key == "ybgg-dgi6_offset_0000000_limit_1000.json"
    assert FAKE_JSON in uploaded.values()


def test_fetch_validate_and_store_raw_catalunya_rejects_empty() -> None:
    def fetch_transport(url: str) -> tuple[int, dict[str, str], bytes]:
        _ = url
        return 200, {"content-type": "application/json"}, b""

    http = httpx.Client(
        transport=httpx.MockTransport(lambda _r: httpx.Response(200)),
    )
    connector = SocrataConnector(fetch_transport=fetch_transport)
    store = SupabaseStorageArtifactStore(
        base_url="http://storage.test",
        service_role_key="test-service-role",
        http_client=http,
    )
    with pytest.raises(ValueError, match="empty"):
        fetch_validate_and_store_raw(
            connector,
            _catalunya_artifact(),
            artifact_store=store,
        )
    http.close()


def _db_available() -> bool:
    try:
        with psycopg.connect(default_database_url(), connect_timeout=2) as conn:
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


@pytest.mark.skipif(
    not (_db_available() and _storage_available()),
    reason="Local Supabase Postgres/Storage not reachable",
)
def test_catalunya_fetch_stores_raw_and_registers_source_artifact() -> None:
    """Live local: catalunya RAW under prefix + source_artifacts row."""
    run_id = f"raw-cat-{uuid.uuid4()}"
    artifact = _catalunya_artifact()

    def fetch_transport(url: str) -> tuple[int, dict[str, str], bytes]:
        assert "ybgg-dgi6.json" in url
        return 200, {"content-type": "application/json"}, FAKE_JSON

    connector = SocrataConnector(fetch_transport=fetch_transport)
    store = SupabaseStorageArtifactStore(
        base_url=default_supabase_url(),
        service_role_key=default_service_role_key() or "",
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
            artifact,
            artifact_store=store,
        )
        artifact_id = sync_repo.register_artifact(run, stored)
        sync_repo.finish_run(run, status="success")
        conn.commit()

        assert stored.storage_path.startswith("raw/catalunya/")
        assert artifact_id is not None

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
        assert row[2] == len(FAKE_JSON)

        # Cleanup fixture rows.
        conn.execute(
            "delete from public.source_artifacts where source_code = %s and artifact_key = %s",
            (SOURCE_CODE, stored.artifact_key),
        )
        conn.execute(
            "delete from public.source_sync where source_code = %s and run_id = %s",
            (SOURCE_CODE, run_id),
        )
        conn.commit()
