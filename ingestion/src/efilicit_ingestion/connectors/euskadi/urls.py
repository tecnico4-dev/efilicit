"""Helpers de URL de KontratazioA / Open Data Euskadi."""

from __future__ import annotations

from dataclasses import dataclass

__all__ = [
    "EuskadiDataset",
    "EUSKADI",
    "page_artifact_key",
    "page_resource_url",
]

# La API documenta tamaño de página fijo = 10 en listados.
ITEMS_PER_PAGE = 10


@dataclass(frozen=True, slots=True)
class EuskadiDataset:
    """Una colección REST de KontratazioA / Open Data Euskadi."""

    source_code: str
    base_url: str
    collection: str

    @property
    def collection_url(self) -> str:
        return f"{self.base_url.rstrip('/')}/{self.collection}"


EUSKADI = EuskadiDataset(
    source_code="euskadi",
    base_url="https://api.euskadi.eus/procurements",
    collection="contracting-notices",
)


def page_artifact_key(dataset: EuskadiDataset, *, page: int) -> str:
    """``artifact_key`` estable de una página API (``currentPage`` 1-based)."""
    if page < 1:
        raise ValueError(f"page must be >= 1, got {page}")
    return f"{dataset.collection}_page_{page:06d}.json"


def page_resource_url(dataset: EuskadiDataset, *, page: int) -> str:
    if page < 1:
        raise ValueError(f"page must be >= 1, got {page}")
    return f"{dataset.collection_url}?currentPage={page}"
