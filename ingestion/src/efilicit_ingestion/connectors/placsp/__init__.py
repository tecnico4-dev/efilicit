"""Conector PLACSP — sindicaciones Atom/CODICE en ZIP (vertical slice Semana 2).

Primer conector real del monorepo: perfiles alojados (``643``), y el mismo
paquete sirve luego para agregadas/menores cambiando ``PlacspSyndication``.
Se descarga el ZIP mensual; RAW en Storage = entries Atom nuevas (ADR 022).
"""

from efilicit_ingestion.connectors.placsp.connector import PlacspConnector, sha256_hex
from efilicit_ingestion.connectors.placsp.expand_entries import (
    ExpandedPlacspEntry,
    expand_placsp_entries,
)
from efilicit_ingestion.connectors.placsp.parser import PlacspParseError
from efilicit_ingestion.connectors.placsp.urls import (
    PLACSP,
    PLACSP_AGREGADAS,
    PLACSP_MENORES,
    PlacspSyndication,
)

__all__ = [
    "ExpandedPlacspEntry",
    "PlacspConnector",
    "PlacspParseError",
    "PlacspSyndication",
    "PLACSP",
    "PLACSP_AGREGADAS",
    "PLACSP_MENORES",
    "expand_placsp_entries",
    "sha256_hex",
]
