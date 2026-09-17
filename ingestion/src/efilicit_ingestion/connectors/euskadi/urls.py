"""Euskadi KontratazioA procurements URL helpers."""

from __future__ import annotations

from dataclasses import dataclass

__all__ = [
    "EuskadiDataset",
    "EUSKADI",
    "page_artifact_key",
    "page_resource_url",
]

# API documents a fixed page size of 10 for list endpoints.
ITEMS_PER_PAGE = 10


@dataclass(frozen=True, slots=True)
class EuskadiDataset:
    """One KontratazioA / Open Data Euskadi REST collection."""

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
    """Stable artifact_key for one API page (1-based ``currentPage``)."""
    if page < 1:
        raise ValueError(f"page must be >= 1, got {page}")
    return f"{dataset.collection}_page_{page:06d}.json"


def page_resource_url(dataset: EuskadiDataset, *, page: int) -> str:
    if page < 1:
        raise ValueError(f"page must be >= 1, got {page}")
    return f"{dataset.collection_url}?currentPage={page}"
