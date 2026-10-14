"""Normalize + identity for placsp_agregadas (Semana 3 Paso 4.3).

Reuses pipeline stages from Semana 2; CODICE payloads are source-agnostic.
No live network.
"""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path

from efilicit_ingestion.connectors.placsp import PLACSP_AGREGADAS, PlacspConnector
from efilicit_ingestion.connectors.placsp.parser import parse_placsp_artifact
from efilicit_ingestion.models import RemoteArtifact
from efilicit_ingestion.pipeline import stages

FIXTURES = Path(__file__).parent / "fixtures" / "placsp"


def _agregadas_artifact(name: str) -> RemoteArtifact:
    return RemoteArtifact(
        artifact_key=name,
        source_url=(
            "https://contrataciondelsectorpublico.gob.es/sindicacion/"
            "sindicacion_1044/PlataformasAgregadasSinMenores.atom"
        ),
        content_type="application/atom+xml",
        metadata={"sindicacion": "1044", "feed_base": "PlataformasAgregadasSinMenores"},
    )


def _parse_agregadas_fixture(name: str) -> list:
    raw = (FIXTURES / name).read_bytes()
    return list(parse_placsp_artifact(raw, _agregadas_artifact(name)))


def test_agregadas_normalize_valid_fixture_maps_mvp_fields() -> None:
    records = _parse_agregadas_fixture("valid_single_entry.atom")
    normalized = stages.normalize(records)
    identified = stages.resolve_identity(normalized)

    assert len(identified) == 1
    canonical = identified[0].payload["canonical"]
    assert canonical["title"].startswith("Suministro de material")
    assert canonical["status"] == "publicada"
    assert canonical["status_code"] == "PUB"
    assert canonical["contract_type"] == "suministros"
    assert canonical["procedure_type"] == "abierto"
    assert canonical["estimated_value"] == Decimal("12500.50")
    assert canonical["currency"] == "EUR"
    assert canonical["cpv_code"] == "30192700"
    assert canonical["nuts_code"] == "ES300"
    assert canonical["publication_date"].isoformat() == "2026-09-10"
    assert canonical["deadline_at"].isoformat().startswith("2026-10-01T14:00:00")
    assert canonical["source_tender_id"] == "B00000000:EXP/2026/0001"
    assert canonical["authority"]["tax_id"] == "B00000000"
    assert canonical["authority"]["name_normalized"] == (
        "organismo fixture de pruebas s.a."
    )
    assert canonical["authority"]["identity_confidence"] == "HIGH"


def test_agregadas_normalize_incomplete_fixture_identity_is_low() -> None:
    records = _parse_agregadas_fixture("incomplete_entry.atom")
    identified = stages.resolve_identity(stages.normalize(records))
    canonical = identified[0].payload["canonical"]

    assert canonical["status"] is None
    assert canonical["estimated_value"] is None
    assert canonical["cpv_code"] is None
    assert canonical["authority"]["tax_id"] is None
    assert canonical["authority"]["identity_confidence"] == "LOW"
    assert "ayuntamiento fixture sin nif" in canonical["authority"]["name_normalized"]


def test_agregadas_connector_parse_normalize_identity_chain() -> None:
    """Parse → normalize → resolve_identity via PlacspConnector (agregadas)."""
    connector = PlacspConnector(syndication=PLACSP_AGREGADAS)
    raw = (FIXTURES / "valid_single_entry.atom").read_bytes()
    artifact = _agregadas_artifact("PlataformasAgregadasSinMenores.atom")

    records = list(connector.parse(raw, artifact))
    identified = stages.resolve_identity(stages.normalize(records))

    assert connector.source_code == "placsp_agregadas"
    assert len(identified) == 1
    assert (
        identified[0].payload["canonical"]["authority"]["identity_confidence"] == "HIGH"
    )
