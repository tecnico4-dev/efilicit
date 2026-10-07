"""Configuración de datasets Socrata / SODA y URLs de página.

Construye ``artifact_key`` y URL SoQL sin scraping HTML: dominio + dataset id
oficiales (ficha en ``docs/sources/catalunya.md``).
"""

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
    """Un dataset SODA concreto (dominio + id) que el conector puede paginar.

    ``order_by`` fija un orden estable (p. ej. ``:id``) para que offset/limit
    no reordenen filas entre corridas y el cursor tenga sentido.
    """

    source_code: str
    domain: str
    dataset_id: str
    order_by: str = ":id"

    @property
    def resource_base_url(self) -> str:
        return f"https://{self.domain}/resource/{self.dataset_id}.json"


# Transparència Catalunya — publicaciones PSCP vía Open Data (no feed Atom).
# Es la CCAA #1 de Semana 3; reutiliza este adaptador Socrata, no PLACSP.
CATALUNYA = SocrataDataset(
    source_code="catalunya",
    domain="analisi.transparenciacatalunya.cat",
    dataset_id="ybgg-dgi6",
    order_by=":id",
)


def page_artifact_key(dataset: SocrataDataset, *, offset: int, limit: int) -> str:
    """Nombre estable del artefacto RAW de una página SODA.

    Incluye offset y limit: si cambias el tamaño de página, el key cambia
    (evita mezclar evidencias de paginaciones distintas en Storage).
    """
    return f"{dataset.dataset_id}_offset_{offset:07d}_limit_{limit:04d}.json"


def page_resource_url(dataset: SocrataDataset, *, offset: int, limit: int) -> str:
    # SoQL: $limit/$offset/$order. Valores enteros / tokens; sin query HTML.
    return (
        f"{dataset.resource_base_url}"
        f"?$limit={limit}&$offset={offset}&$order={dataset.order_by}"
    )
