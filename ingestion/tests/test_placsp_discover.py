"""Unit tests for PLACSP discover (perfiles + agregadas + menores). No live network."""

from __future__ import annotations

from datetime import date

import pytest

from efilicit_ingestion.connectors import SourceConnector
from efilicit_ingestion.connectors.placsp import (
    PLACSP_AGREGADAS,
    PLACSP_MENORES,
    PlacspConnector,
)
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
    assert art.metadata["sindicacion"] == "643"
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


def test_agregadas_is_source_connector() -> None:
    connector = PlacspConnector(
        syndication=PLACSP_AGREGADAS,
        as_of=date(2026, 9, 11),
    )
    assert isinstance(connector, SourceConnector)
    assert connector.source_code == "placsp_agregadas"


def test_discover_agregadas_current_month_stable_key() -> None:
    connector = PlacspConnector(
        syndication=PLACSP_AGREGADAS,
        as_of=date(2026, 9, 15),
    )
    artifacts = connector.discover(
        SyncContext(source_code="placsp_agregadas", run_id="discover-agregadas-1")
    )

    assert len(artifacts) == 1
    art = artifacts[0]
    assert art.artifact_key == "PlataformasAgregadasSinMenores_202609.zip"
    assert art.source_url == (
        "https://contrataciondelsectorpublico.gob.es/sindicacion/"
        "sindicacion_1044/PlataformasAgregadasSinMenores_202609.zip"
    )
    assert art.content_type == "application/zip"
    assert art.metadata["feed_base"] == "PlataformasAgregadasSinMenores"
    assert art.metadata["sindicacion"] == "1044"
    assert art.metadata["package_kind"] == "monthly"
    assert art.metadata["year"] == 2026
    assert art.metadata["month"] == 9


def test_discover_agregadas_range_cursor_and_probe() -> None:
    available = {
        monthly_package_url(2026, 8, PLACSP_AGREGADAS),
        monthly_package_url(2026, 9, PLACSP_AGREGADAS),
    }
    connector = PlacspConnector(
        syndication=PLACSP_AGREGADAS,
        from_year_month="2026-07",
        to_year_month="2026-09",
        url_exists=lambda url: url in available,
    )
    cursor = "PlataformasAgregadasSinMenores_202607.zip"
    artifacts = connector.discover(
        SyncContext(
            source_code="placsp_agregadas",
            run_id="discover-agregadas-cursor",
            cursor=cursor,
        )
    )

    assert [a.artifact_key for a in artifacts] == [
        "PlataformasAgregadasSinMenores_202608.zip",
        "PlataformasAgregadasSinMenores_202609.zip",
    ]
    assert all(a.metadata["sindicacion"] == "1044" for a in artifacts)


def test_menores_is_source_connector() -> None:
    connector = PlacspConnector(
        syndication=PLACSP_MENORES,
        as_of=date(2026, 9, 17),
    )
    assert isinstance(connector, SourceConnector)
    assert connector.source_code == "placsp_menores"


def test_discover_menores_current_month_stable_key() -> None:
    connector = PlacspConnector(
        syndication=PLACSP_MENORES,
        as_of=date(2026, 9, 17),
    )
    artifacts = connector.discover(
        SyncContext(source_code="placsp_menores", run_id="discover-menores-1")
    )

    assert len(artifacts) == 1
    art = artifacts[0]
    assert art.artifact_key == "contratosMenoresPerfilesContratantes_202609.zip"
    assert art.source_url == (
        "https://contrataciondelsectorpublico.gob.es/sindicacion/"
        "sindicacion_1143/contratosMenoresPerfilesContratantes_202609.zip"
    )
    assert art.content_type == "application/zip"
    assert art.metadata["feed_base"] == "contratosMenoresPerfilesContratantes"
    assert art.metadata["sindicacion"] == "1143"
    assert art.metadata["package_kind"] == "monthly"
    assert art.metadata["year"] == 2026
    assert art.metadata["month"] == 9


def test_discover_menores_range_cursor_and_probe() -> None:
    available = {
        monthly_package_url(2026, 8, PLACSP_MENORES),
        monthly_package_url(2026, 9, PLACSP_MENORES),
    }
    connector = PlacspConnector(
        syndication=PLACSP_MENORES,
        from_year_month="2026-07",
        to_year_month="2026-09",
        url_exists=lambda url: url in available,
    )
    cursor = "contratosMenoresPerfilesContratantes_202607.zip"
    artifacts = connector.discover(
        SyncContext(
            source_code="placsp_menores",
            run_id="discover-menores-cursor",
            cursor=cursor,
        )
    )

    assert [a.artifact_key for a in artifacts] == [
        "contratosMenoresPerfilesContratantes_202608.zip",
        "contratosMenoresPerfilesContratantes_202609.zip",
    ]
    assert all(a.metadata["sindicacion"] == "1143" for a in artifacts)


def test_parse_year_month_formats() -> None:
    assert parse_year_month("2026-09") == (2026, 9)
    assert parse_year_month("202609") == (2026, 9)
    with pytest.raises(ValueError):
        parse_year_month("2026/09")
