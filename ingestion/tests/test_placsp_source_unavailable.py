"""Soft-skip cuando PLACSP no sirve el ZIP (WAF / no publicado)."""

from __future__ import annotations

from datetime import date

import pytest

from efilicit_ingestion.cli import main
from efilicit_ingestion.connectors.placsp.errors import (
    ArtifactTooLargeError,
    InvalidZipPayloadError,
    PlacspHttpError,
    placsp_source_unavailable_reason,
)
from efilicit_ingestion.connectors.placsp.fetch import FetchSettings, download_bytes
from efilicit_ingestion.pipeline.ports import InMemoryArtifactStore, InMemorySyncRepository
from efilicit_ingestion.pipeline.canonical_repo import InMemoryCanonicalRepository
from efilicit_ingestion.pipeline.placsp_incremental import run_pipeline_placsp_incremental
from efilicit_ingestion.pipeline.runner import SourceUnavailableError
from efilicit_ingestion.connectors.placsp import PlacspConnector
from efilicit_ingestion.models import SyncContext


def test_classify_invalid_zip_is_source_unavailable() -> None:
    reason = placsp_source_unavailable_reason(
        InvalidZipPayloadError("missing PK header: example.zip")
    )
    assert reason is not None
    assert "valid ZIP" in reason


def test_classify_http_404_is_source_unavailable() -> None:
    reason = placsp_source_unavailable_reason(
        PlacspHttpError(404, "https://example.test/x.zip")
    )
    assert reason is not None
    assert "404" in reason


def test_classify_too_large_is_not_source_unavailable() -> None:
    assert placsp_source_unavailable_reason(ArtifactTooLargeError("too big")) is None


def test_pipeline_soft_skips_invalid_zip() -> None:
    def transport(url: str) -> tuple[int, dict[str, str], bytes]:
        _ = url
        return 200, {"content-type": "text/html"}, b"<html>Request Rejected</html>"

    connector = PlacspConnector(
        as_of=date(2026, 11, 25),
        fetch_transport=transport,
        invalid_zip_retry_attempts=2,
        invalid_zip_retry_wait_seconds=0,
    )
    sync_repo = InMemorySyncRepository()
    with pytest.raises(SourceUnavailableError) as caught:
        run_pipeline_placsp_incremental(
            connector,
            SyncContext(source_code="placsp", run_id="soft-skip-1"),
            artifact_store=InMemoryArtifactStore(),
            sync_repo=sync_repo,
            canonical_repo=InMemoryCanonicalRepository(),
        )
    assert caught.value.sync.status == "success"
    assert caught.value.sync.error_message is not None
    assert "ZIP" in caught.value.sync.error_message


def test_pipeline_still_fails_on_oversized() -> None:
    def transport(url: str) -> tuple[int, dict[str, str], bytes]:
        _ = url
        return 200, {"content-length": "9999"}, b"PK\x03\x04" + b"x" * 100

    connector = PlacspConnector(
        as_of=date(2026, 11, 25),
        fetch_transport=transport,
        max_bytes=32,
    )
    sync_repo = InMemorySyncRepository()
    with pytest.raises(Exception) as caught:
        run_pipeline_placsp_incremental(
            connector,
            SyncContext(source_code="placsp", run_id="hard-fail-1"),
            artifact_store=InMemoryArtifactStore(),
            sync_repo=sync_repo,
            canonical_repo=InMemoryCanonicalRepository(),
        )
    # No soft-skip: sigue siendo fallo de pipeline / tamaño.
    assert not isinstance(caught.value, SourceUnavailableError)
    run = sync_repo.runs[("placsp", "hard-fail-1")]
    assert run.status == "failed"


def test_cli_soft_skip_exit_zero(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    from efilicit_ingestion import cli as cli_mod
    from efilicit_ingestion.pipeline.types import SyncRun
    from efilicit_ingestion.pipeline.runner import SourceUnavailableError

    sync = SyncRun(
        source_code="placsp",
        run_id="cli-soft-1",
        status="success",
        error_message="PLACSP did not serve a valid ZIP",
    )

    def boom(_config: object) -> object:
        raise SourceUnavailableError(
            sync,
            InvalidZipPayloadError("missing PK"),
            reason=sync.error_message or "unavailable",
        )

    monkeypatch.setattr(cli_mod, "run_placsp", boom)
    code = main(
        [
            "run-placsp",
            "--from-month",
            "2026-11",
            "--syndication",
            "placsp",
        ]
    )
    captured = capsys.readouterr()
    assert code == 0
    assert "source_unavailable=1" in captured.out
    assert "::warning::" in captured.err
    assert "PLACSP no sirvió el ZIP" in captured.err


def test_download_bytes_invalid_zip_raises_typed() -> None:
    def transport(url: str) -> tuple[int, dict[str, str], bytes]:
        _ = url
        return 200, {}, b"not-zip"

    with pytest.raises(InvalidZipPayloadError):
        download_bytes(
            "https://example.test/x.zip",
            settings=FetchSettings(
                invalid_zip_retry_attempts=2,
                invalid_zip_retry_wait_seconds=0,
            ),
            transport=transport,
        )
