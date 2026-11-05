"""Familia de conector Socrata / SODA (Semana 3 Paso 7 + ADR 025).

SODA pagina con ``$limit`` / ``$offset`` (+ ``$where`` de ventana). La página
se descarga para expandir; Storage materializa RAW por fila
(``rows/{checksum}.json``) con skip por checksum — mismo patrón que PLACSP 022.

Preset por defecto: Transparència Catalunya ``ybgg-dgi6`` (publicaciones PSCP).
"""

from efilicit_ingestion.connectors.socrata.connector import SocrataConnector, sha256_hex
from efilicit_ingestion.connectors.socrata.errors import (
    SocrataFetchError,
    SocrataHttpError,
    SocrataParseError,
)
from efilicit_ingestion.connectors.socrata.expand_rows import (
    ExpandedSocrataRow,
    expand_socrata_rows,
)
from efilicit_ingestion.connectors.socrata.urls import CATALUNYA, SocrataDataset

__all__ = [
    "SocrataConnector",
    "SocrataDataset",
    "CATALUNYA",
    "ExpandedSocrataRow",
    "expand_socrata_rows",
    "SocrataFetchError",
    "SocrataHttpError",
    "SocrataParseError",
    "sha256_hex",
]
