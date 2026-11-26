"""Tipos del motor de recomendaciones (ADR 034)."""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Literal

ProfileKind = Literal["propia", "subcontrata"]
SeedSource = Literal[
    "rating",
    "favorite",
    "common",
    "peer_share",
    "offer_case",
]


@dataclass(frozen=True, slots=True)
class Seed:
    """Licitación semilla para un perfil."""

    tender_id: str
    weight: float
    source: SeedSource
    title: str = ""
    cpv_codes: tuple[str, ...] = ()
    contract_type: str | None = None
    estimated_value: Decimal | None = None


@dataclass(frozen=True, slots=True)
class CandidateTender:
    tender_id: str
    title: str
    description: str = ""
    cpv_codes: tuple[str, ...] = ()
    contract_type: str | None = None
    estimated_value: Decimal | None = None
    # Precomputados en SQL (opcionales): ts_rank y mejor similarity título
    text_rank: float = 0.0
    title_similarity: float = 0.0


@dataclass(frozen=True, slots=True)
class Recommendation:
    tender_id: str
    # None = empate de score entre propia y subcontrata (solo lista Todas).
    profile_kind: ProfileKind | None
    score: float
    reason: dict[str, Any] = field(default_factory=dict)
