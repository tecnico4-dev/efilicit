"""Helpers de URL de KontratazioA / Open Data Euskadi.

La API pagina con ``currentPage`` (1-based) y tamaño de página **fijo = 10**
(documentación oficial). No hay ``$limit`` configurable como en SODA.
"""

from __future__ import annotations

from dataclasses import dataclass

__all__ = [
    "EuskadiDataset",
    "EUSKADI",
    "ITEMS_PER_PAGE",
    "page_artifact_key",
    "page_resource_url",
]

# Documentado por la API: no negociable en el discover (metadata / tests).
ITEMS_PER_PAGE = 10


@dataclass(frozen=True, slots=True)
class EuskadiDataset:
    """Una colección REST de procurements (base + nombre de colección)."""

    source_code: str
    base_url: str
    collection: str

    @property
    def collection_url(self) -> str:
        return f"{self.base_url.rstrip('/')}/{self.collection}"


# Avisos de contratación (CCAA #2 Semana 3). Ficha: docs/sources/euskadi.md.
EUSKADI = EuskadiDataset(
    source_code="euskadi",
    base_url="https://api.euskadi.eus/procurements",
    collection="contracting-notices",
)


def page_artifact_key(dataset: EuskadiDataset, *, page: int) -> str:
    """``artifact_key`` estable de una página (page zero-padded → orden lex = orden)."""
    if page < 1:
        raise ValueError(f"page must be >= 1, got {page}")
    return f"{dataset.collection}_page_{page:06d}.json"


def page_resource_url(dataset: EuskadiDataset, *, page: int) -> str:
    """URL de listado; solo ``currentPage`` (el tamaño lo fija el servidor)."""
    if page < 1:
        raise ValueError(f"page must be >= 1, got {page}")
    return f"{dataset.collection_url}?currentPage={page}"
