"""Conector Euskadi / KontratazioA REST (Semana 3 Paso 9 + ADR 025).

Segunda CCAA propia del MVP: API oficial ``api.euskadi.eus/procurements``,
colección ``contracting-notices``. Misma tubería canónica que Catalunya/PLACSP;
la página se descarga para expandir; Storage materializa RAW por aviso
(``rows/{checksum}.json``) con skip por checksum.
"""

from efilicit_ingestion.connectors.euskadi.connector import EuskadiConnector, sha256_hex
from efilicit_ingestion.connectors.euskadi.errors import (
    EuskadiFetchError,
    EuskadiHttpError,
    EuskadiParseError,
)
from efilicit_ingestion.connectors.euskadi.expand_items import (
    ExpandedEuskadiItem,
    expand_euskadi_items,
)
from efilicit_ingestion.connectors.euskadi.urls import EUSKADI, EuskadiDataset

__all__ = [
    "EuskadiConnector",
    "EuskadiDataset",
    "EUSKADI",
    "ExpandedEuskadiItem",
    "expand_euskadi_items",
    "EuskadiFetchError",
    "EuskadiHttpError",
    "EuskadiParseError",
    "sha256_hex",
]
