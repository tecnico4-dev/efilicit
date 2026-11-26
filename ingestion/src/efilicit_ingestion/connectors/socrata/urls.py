"""Configuración de datasets Socrata / SODA y URLs de página.

Construye ``artifact_key`` y URL SoQL sin scraping HTML: dominio + dataset id
oficiales (ficha en ``docs/sources/catalunya.md``).
"""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import quote

__all__ = [
    "SocrataDataset",
    "CATALUNYA",
    "page_artifact_key",
    "page_resource_url",
    "publication_since_where",
]


@dataclass(frozen=True, slots=True)
class SocrataDataset:
    """Un dataset SODA concreto (dominio + id) que el conector puede paginar.

    ``order_by`` fija un orden estable para que offset/limit no reordenen filas
    entre corridas dentro de la misma ventana SoQL.
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
# Orden por fecha de anuncio (ADR 025); desempate :id estable.
CATALUNYA = SocrataDataset(
    source_code="catalunya",
    domain="analisi.transparenciacatalunya.cat",
    dataset_id="ybgg-dgi6",
    order_by="data_publicacio_anunci DESC,:id DESC",
)


def page_artifact_key(dataset: SocrataDataset, *, offset: int, limit: int) -> str:
    """Nombre estable del artefacto de página SODA (solo discover; no Storage ADR 025).

    Incluye offset y limit: si cambias el tamaño de página, el key cambia.
    """
    return f"{dataset.dataset_id}_offset_{offset:07d}_limit_{limit:04d}.json"


def publication_since_where(since_iso: str) -> str:
    """Cláusula SoQL ``$where`` por ``data_publicacio_anunci`` (ADR 025)."""
    return f"data_publicacio_anunci >= '{since_iso}'"


def page_resource_url(
    dataset: SocrataDataset,
    *,
    offset: int,
    limit: int,
    where: str | None = None,
) -> str:
    """URL SoQL: ``$limit`` / ``$offset`` / ``$order`` y opcional ``$where``."""
    # safe=",:" conserva comas y :id en $order; espacios → %20.
    query = (
        f"$limit={limit}"
        f"&$offset={offset}"
        f"&$order={quote(dataset.order_by, safe=',:')}"
    )
    if where:
        query = f"{query}&$where={quote(where, safe='')}"
    return f"{dataset.resource_base_url}?{query}"
