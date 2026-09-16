"""Socrata / SODA dataset configuration and page URL helpers."""

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
    """One SODA dataset on a Socrata Open Data domain."""

    source_code: str
    domain: str
    dataset_id: str
    order_by: str = ":id"

    @property
    def resource_base_url(self) -> str:
        return f"https://{self.domain}/resource/{self.dataset_id}.json"


# Transparència Catalunya — publicacions PSCP (datos.gob.es / Open Data).
CATALUNYA = SocrataDataset(
    source_code="catalunya",
    domain="analisi.transparenciacatalunya.cat",
    dataset_id="ybgg-dgi6",
    order_by=":id",
)


def page_artifact_key(dataset: SocrataDataset, *, offset: int, limit: int) -> str:
    """Stable artifact_key for one SODA page."""
    return f"{dataset.dataset_id}_offset_{offset:07d}_limit_{limit:04d}.json"


def page_resource_url(dataset: SocrataDataset, *, offset: int, limit: int) -> str:
    # Keep SoQL `$` params readable; values are integers / simple tokens.
    return (
        f"{dataset.resource_base_url}"
        f"?$limit={limit}&$offset={offset}&$order={dataset.order_by}"
    )
