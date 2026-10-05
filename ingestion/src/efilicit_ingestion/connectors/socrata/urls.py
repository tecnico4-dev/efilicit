"""Configuración de datasets Socrata / SODA y URLs de página."""

from __future__ import annotations

from dataclasses import dataclass

__all__ = [
    "SocrataDataset",
    "CATALUNYA",
    "page_artifact_key",
    "page_resource_url",
]


@dataclass(frozen=True, slots=True)
class SocrataDataset:
    """Un dataset SODA en un dominio Open Data Socrata."""

    source_code: str
    domain: str
    dataset_id: str
    order_by: str = ":id"

    @property
    def resource_base_url(self) -> str:
        return f"https://{self.domain}/resource/{self.dataset_id}.json"


# Transparència Catalunya — publicaciones PSCP (Open Data).
CATALUNYA = SocrataDataset(
    source_code="catalunya",
    domain="analisi.transparenciacatalunya.cat",
    dataset_id="ybgg-dgi6",
    order_by=":id",
)


def page_artifact_key(dataset: SocrataDataset, *, offset: int, limit: int) -> str:
    """``artifact_key`` estable de una página SODA (offset + limit)."""
    return f"{dataset.dataset_id}_offset_{offset:07d}_limit_{limit:04d}.json"


def page_resource_url(dataset: SocrataDataset, *, offset: int, limit: int) -> str:
    # Parámetros SoQL ``$`` legibles; valores enteros / tokens simples.
    return (
        f"{dataset.resource_base_url}"
        f"?$limit={limit}&$offset={offset}&$order={dataset.order_by}"
    )
