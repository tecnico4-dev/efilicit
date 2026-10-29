"""Tests expand PLACSP ZIP/Atom → entries content-addressed (ADR 022)."""

from __future__ import annotations

from pathlib import Path

from efilicit_ingestion.connectors.placsp.expand_entries import (
    expand_placsp_entries,
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
