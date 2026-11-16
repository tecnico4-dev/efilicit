"""Tests expand PLACSP ZIP/Atom → entries content-addressed (ADR 022 / 033)."""

from __future__ import annotations

import io
import zipfile
from pathlib import Path

from efilicit_ingestion.connectors.placsp.expand_entries import (
    expand_placsp_entries,
    expand_placsp_pages,
    entry_artifact_key,
)
from efilicit_ingestion.models import RemoteArtifact
from efilicit_ingestion.pipeline.canonical_repo import InMemoryCanonicalRepository
from efilicit_ingestion.pipeline.placsp_incremental import run_pipeline_placsp_incremental
from efilicit_ingestion.pipeline.ports import InMemoryArtifactStore, InMemorySyncRepository
from efilicit_ingestion.run_placsp import PlacspRunConfig, load_fixture_bytes, run_placsp

FIXTURES = Path(__file__).parent / "fixtures" / "placsp"


def _package(key: str = "licitacionesPerfilesContratanteCompleto3_202609.zip") -> RemoteArtifact:
    return RemoteArtifact(
        artifact_key=key,
        source_url=f"https://example.test/{key}",
        content_type="application/zip",
    )


def _zip_two_atoms() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("page_a.atom", (FIXTURES / "notif_test_v1.atom").read_bytes())
        zf.writestr("page_b.atom", (FIXTURES / "notif_test_v2.atom").read_bytes())
    return buf.getvalue()


def test_expand_atom_fixture_produces_stable_checksum() -> None:
    raw = (FIXTURES / "valid_single_entry.atom").read_bytes()
    entries = expand_placsp_entries(raw, _package("valid_single_entry.atom"))
    assert len(entries) == 1
    e = entries[0]
    assert e.checksum
    assert e.artifact_key == entry_artifact_key(e.checksum)
    assert e.raw.startswith(b"<?xml")
    again = expand_placsp_entries(raw, _package("valid_single_entry.atom"))
    assert again[0].checksum == e.checksum


def test_expand_zip_fixture_wraps_atom_member() -> None:
    zip_bytes = load_fixture_bytes(FIXTURES / "valid_single_entry.atom")
    assert zip_bytes.startswith(b"PK")
    entries = expand_placsp_entries(zip_bytes, _package())
    assert len(entries) >= 1
    assert all(e.artifact_key.startswith("entries/") for e in entries)


def test_incremental_second_run_skips_storage_uploads() -> None:
    """Misma fixture dos veces: la segunda no añade objetos RAW nuevos."""
    result1 = run_placsp(
        PlacspRunConfig(
            fixture_path=FIXTURES / "valid_single_entry.atom",
            dry_run=True,
            as_of=__import__("datetime").date(2026, 9, 11),
        )
    )
    assert result1.sync.status == "success"
    assert len(result1.stored_artifacts) >= 1
    n_first = len(result1.stored_artifacts)

    # Segunda corrida compartiendo stores vía API de bajo nivel
    from datetime import date

    from efilicit_ingestion.connectors.placsp import PlacspConnector
    from efilicit_ingestion.models import SyncContext

    fixture_bytes = load_fixture_bytes(FIXTURES / "valid_single_entry.atom")
    store = InMemoryArtifactStore()
    sync_repo = InMemorySyncRepository()
    # Prefill sync_repo as if first run registered artifacts
    for stored in result1.stored_artifacts:
        sync_repo.artifacts_by_checksum[("placsp", stored.checksum)] = (
            f"pre-{stored.checksum[:8]}",
            stored,
        )
        store.objects[stored.storage_path] = b"already-there"

    objects_before = dict(store.objects)
    connector = PlacspConnector(
        as_of=date(2026, 9, 11),
        from_year_month="2026-09",
        to_year_month="2026-09",
        fetch_transport=lambda url, data=fixture_bytes: (
            200,
            {"content-type": "application/zip", "content-length": str(len(data))},
            data,
        ),
    )
    result2 = run_pipeline_placsp_incremental(
        connector,
        SyncContext(source_code="placsp", run_id="second-run"),
        artifact_store=store,
        sync_repo=sync_repo,
        canonical_repo=InMemoryCanonicalRepository(),
    )
    assert result2.sync.status == "success"
    assert result2.stored_artifacts == []
    assert store.objects == objects_before
    assert n_first >= 1


def test_expand_zip_pages_one_page_per_atom_member() -> None:
    pages = expand_placsp_pages(_zip_two_atoms(), _package())
    assert len(pages) == 2
    assert [p.member_name for p in pages] == ["page_a.atom", "page_b.atom"]
    assert all(len(p.entries) >= 1 for p in pages)
    flat = expand_placsp_entries(_zip_two_atoms(), _package())
    assert len(flat) == sum(len(p.entries) for p in pages)


def test_incremental_on_page_committed_per_atom_member() -> None:
    """Cada ``.atom`` del ZIP dispara ``on_page_committed`` (ADR 033)."""
    from datetime import date

    from efilicit_ingestion.connectors.placsp import PlacspConnector
    from efilicit_ingestion.models import SyncContext

    zip_bytes = _zip_two_atoms()
    commits: list[str] = []

    connector = PlacspConnector(
        as_of=date(2026, 9, 11),
        from_year_month="2026-09",
        to_year_month="2026-09",
        fetch_transport=lambda url, data=zip_bytes: (
            200,
            {"content-type": "application/zip", "content-length": str(len(data))},
            data,
        ),
    )
    result = run_pipeline_placsp_incremental(
        connector,
        SyncContext(source_code="placsp", run_id="page-commit-run"),
        artifact_store=InMemoryArtifactStore(),
        sync_repo=InMemorySyncRepository(),
        canonical_repo=InMemoryCanonicalRepository(),
        on_page_committed=lambda: commits.append("ok"),
    )
    assert result.sync.status == "success"
    assert len(commits) == 2
    assert len(result.stored_artifacts) >= 2
    for stored in result.stored_artifacts:
        assert stored.storage_path.startswith("raw/placsp/entries/")
        assert "/2026/" not in stored.storage_path


def test_incremental_failure_after_first_page_keeps_first_uploads() -> None:
    """Tras commit de la 1ª página, un fallo en la 2ª no borra lo ya materializado."""
    from datetime import date

    from efilicit_ingestion.connectors.placsp import PlacspConnector
    from efilicit_ingestion.models import SyncContext
    from efilicit_ingestion.pipeline.runner import PipelineRunError

    zip_bytes = _zip_two_atoms()
    store = InMemoryArtifactStore()
    sync_repo = InMemorySyncRepository()
    after_page_object_counts: list[int] = []

    def commit_then_fail_on_second() -> None:
        after_page_object_counts.append(len(store.objects))
        if len(after_page_object_counts) >= 2:
            raise RuntimeError("boom after first page commit")

    connector = PlacspConnector(
        as_of=date(2026, 9, 11),
        from_year_month="2026-09",
        to_year_month="2026-09",
        fetch_transport=lambda url, data=zip_bytes: (
            200,
            {"content-type": "application/zip", "content-length": str(len(data))},
            data,
        ),
    )
    try:
        run_pipeline_placsp_incremental(
            connector,
            SyncContext(source_code="placsp", run_id="fail-mid-pages"),
            artifact_store=store,
            sync_repo=sync_repo,
            canonical_repo=InMemoryCanonicalRepository(),
            on_page_committed=commit_then_fail_on_second,
        )
        raise AssertionError("expected PipelineRunError")
    except PipelineRunError:
        pass

    assert len(after_page_object_counts) == 2
    assert after_page_object_counts[0] >= 1
    # En memoria no hay rollback; el snapshot de la 1ª página sigue presente.
    assert len(store.objects) >= after_page_object_counts[0]
    assert any(path.startswith("raw/placsp/entries/") for path in store.objects)
