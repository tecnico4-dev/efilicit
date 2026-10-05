"""Conector PLACSP — sindicaciones Atom/CODICE en ZIP (vertical slice Semana 2).

Primer conector real del monorepo: perfiles alojados (``643``), y el mismo
paquete sirve luego para agregadas/menores cambiando ``PlacspSyndication``.
El artefacto RAW es el ZIP mensual oficial (no scraping HTML).
"""

from efilicit_ingestion.connectors.placsp.connector import PlacspConnector, sha256_hex
from efilicit_ingestion.connectors.placsp.parser import PlacspParseError
from efilicit_ingestion.connectors.placsp.urls import (
    PLACSP,
    PLACSP_AGREGADAS,
    PLACSP_MENORES,
    PlacspSyndication,
)

__all__ = [
    "PlacspConnector",
    "PlacspParseError",
    "PlacspSyndication",
    "PLACSP",
    "PLACSP_AGREGADAS",
    "PLACSP_MENORES",
    "sha256_hex",
]
