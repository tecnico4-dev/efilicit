"""Copy de bitácora del intake (sin DB)."""

from __future__ import annotations

from efilicit_ingestion.run_offer_intake import _log_body


def test_log_body_first_load_with_downloads() -> None:
    text = _log_body(
        {
            "pliegos_new": 2,
            "requirements_new": 3,
            "deliverables_new": 6,
            "milestones_new": 1,
            "documents_downloaded": 2,
            "documents_failed": 0,
        }
    )
    assert text.startswith("Se han cargado datos del anuncio de la Plataforma:")
    assert "2 pliegos" in text
    assert "3 requisitos" in text
    assert "6 criterios en sobres" in text
    assert "1 plazo" in text
    assert "Se han descargado 2 documentos." in text
    assert "Intake" not in text
    assert "0 " not in text


def test_log_body_reprocess_only_downloads() -> None:
    text = _log_body(
        {
            "pliegos_new": 0,
            "requirements_new": 0,
            "deliverables_new": 0,
            "milestones_new": 0,
            "documents_downloaded": 2,
            "documents_failed": 0,
        }
    )
    assert "No había datos nuevos que añadir." in text
    assert "Se han descargado 2 documentos." in text


def test_log_body_no_changes() -> None:
    text = _log_body(
        {
            "pliegos_new": 0,
            "requirements_new": 0,
            "deliverables_new": 0,
            "milestones_new": 0,
            "documents_downloaded": 0,
            "documents_failed": 0,
        }
    )
    assert "no había cambios ni documentos pendientes" in text


def test_log_body_download_failures() -> None:
    text = _log_body(
        {
            "pliegos_new": 1,
            "requirements_new": 0,
            "deliverables_new": 0,
            "milestones_new": 0,
            "documents_downloaded": 1,
            "documents_failed": 1,
        }
    )
    assert "1 pliego" in text
    assert "Se ha descargado 1 documento; 1 no se pudo descargar." in text
