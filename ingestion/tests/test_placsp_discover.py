"""Unit tests for PLACSP discover (Semana 2 Paso 2). No live network."""

from __future__ import annotations

from datetime import date

import pytest

from efilicit_ingestion.connectors import SourceConnector
from efilicit_ingestion.connectors.placsp import PlacspConnector
from efilicit_ingestion.connectors.placsp.urls import (
    monthly_package_url,
    parse_year_month,
)
from efilicit_ingestion.models import SyncContext


def test_placsp_is_source_connector() -> None:
    connector = PlacspConnector(as_of=date(2026, 9, 11))
    assert isinstance(connector, SourceConnector)
    assert connector.source_code == "placsp"


def test_discover_default_current_month_stable_key() -> None:
    connector = PlacspConnector(as_of=date(2026, 9, 11))
    context = SyncContext(source_code="placsp", run_id="discover-1")

    artifacts = connector.discover(context)

    assert len(artifacts) == 1
    art = artifacts[0]
    assert art.artifact_key == "licitacionesPerfilesContratanteCompleto3_202609.zip"
    assert art.source_url == (
        "https://contrataciondelsectorpublico.gob.es/sindicacion/"
        "sindicacion_643/licitacionesPerfilesContratanteCompleto3_202609.zip"
    )
    assert art.content_type == "application/zip"
    assert art.metadata["package_kind"] == "monthly"
    assert art.metadata["year"] == 2026
    assert art.metadata["month"] == 9


def test_discover_month_range_ordered_stable_keys() -> None:
    connector = PlacspConnector(
        from_year_month="2026-07",
        to_year_month="2026-09",
        as_of=date(2026, 9, 11),
    )
    artifacts = connector.discover(
        SyncContext(source_code="placsp", run_id="discover-range")
    )

    keys = [a.artifact_key for a in artifacts]
    assert keys == [
        "licitacionesPerfilesContratanteCompleto3_202607.zip",
        "licitacionesPerfilesContratanteCompleto3_202608.zip",
        "licitacionesPerfilesContratanteCompleto3_202609.zip",
    ]
    # Re-run must be deterministic (stable keys).
    again = connector.discover(
        SyncContext(source_code="placsp", run_id="discover-range-2")
    )
    assert [a.artifact_key for a in again] == keys


def test_discover_respects_cursor() -> None:
    connector = PlacspConnector(
        from_year_month="2026-07",
        to_year_month="2026-09",
    )
    cursor = "licitacionesPerfilesContratanteCompleto3_202607.zip"
    artifacts = connector.discover(
        SyncContext(source_code="placsp", run_id="discover-cursor", cursor=cursor)
    )

    assert [a.artifact_key for a in artifacts] == [
        "licitacionesPerfilesContratanteCompleto3_202608.zip",
        "licitacionesPerfilesContratanteCompleto3_202609.zip",
    ]


def test_discover_probe_skips_missing_packages() -> None:
    available = {
        monthly_package_url(2026, 8),
        monthly_package_url(2026, 9),
    }

    connector = PlacspConnector(
        from_year_month="2026-07",
        to_year_month="2026-09",
        url_exists=lambda url: url in available,
    )
    artifacts = connector.discover(
        SyncContext(source_code="placsp", run_id="discover-probe")
    )

    assert [a.artifact_key for a in artifacts] == [
        "licitacionesPerfilesContratanteCompleto3_202608.zip",
        "licitacionesPerfilesContratanteCompleto3_202609.zip",
    ]


def test_parse_year_month_formats() -> None:
    assert parse_year_month("2026-09") == (2026, 9)
    assert parse_year_month("202609") == (2026, 9)
    with pytest.raises(ValueError):
        parse_year_month("2026/09")
