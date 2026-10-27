"""Contrato de ``criteria`` (jsonb) para alerts y saved_searches — Semana 5 Paso 1.

Misma forma que ``packages/types/src/criteria.ts`` (TS ↔ Python).
Aquí solo shape + validación ligera; el motor de matching es Paso 7.

Reglas de producto:

- ``version: 1`` fijo en el MVP.
- Dimensiones omitidas = no filtran.
- Criteria vacío (solo version) → **sin matches** (anti-spam).
- Dentro de una dimensión tipo lista: OR; entre dimensiones: AND (en el matcher).
- CPV: ``cpv_match`` ``any`` (default) | ``all`` (ADR 019).
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, model_validator

CriteriaVersion = Literal[1]
CpvMatchMode = Literal["any", "all"]


class AuthorityCriteria(BaseModel):
    """Filtro de organismo: NIF/CIF primario; nombre solo como señal débil."""

    model_config = ConfigDict(extra="forbid")

    tax_ids: list[str] | None = None
    ids: list[str] | None = None
    name_contains: str | None = None


class GeographyCriteria(BaseModel):
    """Lugar de ejecución (códigos) + legacy sede organismo.

    Preferido: ``ccaa_codes`` / ``municipality_codes`` sobre ``tenders.place_*``.
    ``municipalities`` (texto) es legacy sobre sede del organismo (ADR 018).
    """

    model_config = ConfigDict(extra="forbid")

    ccaa_codes: list[str] | None = None
    municipality_codes: list[str] | None = None
    municipalities: list[str] | None = None
    countries: list[str] | None = None


class SearchCriteria(BaseModel):
    """Shape de ``alerts.criteria`` / ``saved_searches.criteria`` (version 1).

    ``extra="forbid"``: claves desconocidas fallan al parsear (contrato estricto).
    """

    model_config = ConfigDict(extra="forbid")

    version: CriteriaVersion = 1
    keywords: list[str] | None = None
    cpv_codes: list[str] | None = None
    cpv_match: CpvMatchMode | None = None
    authority: AuthorityCriteria | None = None
    geography: GeographyCriteria | None = None
    estimated_value_min: float | None = None
    estimated_value_max: float | None = None
    contract_types: list[str] | None = None
    procedure_types: list[str] | None = None
    statuses: list[str] | None = None
    publication_date_from: str | None = None
    publication_date_to: str | None = None
    deadline_from: str | None = None
    deadline_to: str | None = None
    open_for_submission: bool | None = None

    @model_validator(mode="after")
    def _value_range_ok(self) -> SearchCriteria:
        lo, hi = self.estimated_value_min, self.estimated_value_max
        if lo is not None and hi is not None and lo > hi:
            raise ValueError("estimated_value_min no puede ser mayor que estimated_value_max")
        return self

    def has_filters(self) -> bool:
        """True si hay alguna dimensión de filtrado (además de ``version``).

        Usado por el matcher: sin filtros → no encolar (evita alertas “todo”).
        """
        # cpv_match solo no filtra; hace falta cpv_codes.
        data = self.model_dump(exclude={"version", "cpv_match"}, exclude_none=True)
        for key, value in data.items():
            if value in (None, [], {}, ""):
                continue
            if isinstance(value, dict) and not any(value.values()):
                continue
            return True
        return False


# Alias semántico: misma forma para alertas y búsquedas guardadas.
AlertCriteria = SearchCriteria

CRITERIA_EXAMPLE_V1: dict[str, Any] = {
    "version": 1,
    "keywords": ["software", "mantenimiento"],
    "cpv_codes": ["72000000"],
    "authority": {"tax_ids": ["P2807900B"]},
    "geography": {
        "ccaa_codes": ["13"],
        "municipality_codes": ["28079"],
        "countries": ["ES"],
    },
    "estimated_value_min": 10_000,
    "estimated_value_max": 500_000,
    "contract_types": ["servicios"],
    "procedure_types": ["abierto"],
    "publication_date_from": "2026-01-01",
    "publication_date_to": "2026-12-31",
}


def parse_criteria(raw: Any) -> SearchCriteria:
    """Parsea JSON/dict a Criteria v1; falla si hay claves desconocidas."""
    if raw is None:
        return SearchCriteria(version=1)
    return SearchCriteria.model_validate(raw)


KNOWN_CRITERIA_KEYS: frozenset[str] = frozenset(
    {
        "version",
        "keywords",
        "cpv_codes",
        "cpv_match",
        "authority",
        "geography",
        "estimated_value_min",
        "estimated_value_max",
        "contract_types",
        "procedure_types",
        "statuses",
        "publication_date_from",
        "publication_date_to",
        "deadline_from",
        "deadline_to",
        "open_for_submission",
    }
)

__all__ = [
    "AlertCriteria",
    "AuthorityCriteria",
    "CRITERIA_EXAMPLE_V1",
    "CpvMatchMode",
    "CriteriaVersion",
    "GeographyCriteria",
    "KNOWN_CRITERIA_KEYS",
    "SearchCriteria",
    "parse_criteria",
]
