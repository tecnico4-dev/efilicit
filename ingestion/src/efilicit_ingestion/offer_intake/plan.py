"""Mapeo puro ``OfferIntakeExtract`` → filas de ``offer_*`` (ADR 035).

Sin DB ni red. Cada fila lleva ``source_key`` estable: el volcado inserta
solo lo que falta y nunca pisa ediciones del usuario.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from efilicit_ingestion.offer_intake.placsp_terms import (
    OfferAwardingCriterion,
    OfferDocumentRef,
    OfferGuarantee,
    OfferIntakeExtract,
    OfferQualification,
)

TITLE_MAX = 160

_QUALIFICATION_CATEGORY = {
    "solvencia_tecnica": "solvencia_tecnica",
    "solvencia_economica": "solvencia_economica",
    "clasificacion": "clasificacion",
    "declaracion": "habilitacion",
}

_QUALIFICATION_LABEL = {
    "solvencia_tecnica": "Solvencia técnica",
    "solvencia_economica": "Solvencia económica",
    "clasificacion": "Clasificación",
    "declaracion": "Declaración",
}

_GUARANTEE_LABEL = {
    "provisional": "Garantía provisional",
    "definitiva": "Garantía definitiva",
    "complementaria": "Garantía complementaria",
    "otra": "Garantía",
}

ENVELOPE_TITLES = {
    "A": "Sobre A · Documentación administrativa",
    "B": "Sobre B · Criterios sujetos a juicio de valor",
    "C": "Sobre C · Criterios evaluables mediante fórmulas",
}


@dataclass(frozen=True, slots=True)
class PliegoRow:
    source_key: str
    pliego_type: str
    title: str
    url: str
    source_uri: str
    source_hash: str | None
    downloadable: bool

    @property
    def initial_fetch_status(self) -> str:
        return "pendiente" if self.downloadable else "solo_enlace"


@dataclass(frozen=True, slots=True)
class RequirementRow:
    source_key: str
    title: str
    literal_text: str | None
    category: str
    requirement_type: str
    envelope: str | None
    required_value: str | None
    sort_order: int
    from_pcap: bool = True


@dataclass(frozen=True, slots=True)
class DeliverableRow:
    source_key: str
    title: str
    envelope: str | None
    points_max: float | None
    sort_order: int
    parent_key: str | None = None


@dataclass(frozen=True, slots=True)
class MilestoneRow:
    source_key: str
    code: str
    title: str
    due_at: datetime
    sort_order: int


@dataclass
class IntakePlan:
    pliegos: list[PliegoRow] = field(default_factory=list)
    requirements: list[RequirementRow] = field(default_factory=list)
    deliverables: list[DeliverableRow] = field(default_factory=list)
    milestones: list[MilestoneRow] = field(default_factory=list)


def target_lot_ids(target_lots: Any) -> set[str]:
    """``offer_cases.target_lots`` (array de ``{id,label}`` o textos) → ids. Vacío = todos."""
    out: set[str] = set()
    if not isinstance(target_lots, list):
        return out
    for item in target_lots:
        if isinstance(item, dict):
            value = item.get("id")
        else:
            value = item
        if value is not None and str(value).strip():
            out.add(str(value).strip())
    return out


def build_intake_plan(
    extract: OfferIntakeExtract,
    *,
    target_lots: Iterable[str] = (),
) -> IntakePlan:
    lots = set(target_lots)

    def in_scope(lot_id: str | None) -> bool:
        return lot_id is None or not lots or lot_id in lots

    plan = IntakePlan()
    plan.pliegos = [_pliego_row(doc) for doc in extract.documents]

    qualifications = [q for q in extract.qualifications if in_scope(q.lot_id)]
    criteria = [c for c in extract.criteria if in_scope(c.lot_id)]

    order = 0
    for qualification in qualifications:
        order += 1
        plan.requirements.append(_qualification_row(qualification, order))
    for guarantee in extract.guarantees:
        order += 1
        plan.requirements.append(_guarantee_row(guarantee, order))
    for criterion in criteria:
        order += 1
        plan.requirements.append(_criterion_row(criterion, order))

    plan.deliverables = _deliverables(plan.requirements, criteria)
    plan.milestones = _milestones(extract)
    return plan


def _pliego_row(doc: OfferDocumentRef) -> PliegoRow:
    return PliegoRow(
        source_key=doc.source_key,
        pliego_type=doc.pliego_type,
        title=_short(doc.title),
        url=doc.uri,
        source_uri=doc.uri,
        source_hash=doc.document_hash,
        downloadable=doc.downloadable,
    )


def _qualification_row(
    q: OfferQualification,
    order: int,
) -> RequirementRow:
    label = _QUALIFICATION_LABEL[q.kind]
    title = q.description if q.kind in ("clasificacion", "declaracion") else f"{label}: {q.description}"
    return RequirementRow(
        source_key=q.source_key,
        title=_short(_lot_prefix(q.lot_id) + title),
        literal_text=q.description,
        category=_QUALIFICATION_CATEGORY[q.kind],
        requirement_type="excluyente",
        envelope="A",
        required_value=f"Umbral: {format_number(q.threshold)}" if q.threshold else None,
        sort_order=order,
    )


def _guarantee_row(g: OfferGuarantee, order: int) -> RequirementRow:
    if g.rate_percent:
        value = f"{format_number(g.rate_percent)} %"
    elif g.amount:
        value = f"{format_number(g.amount)} €"
    else:
        value = None
    return RequirementRow(
        source_key=g.source_key,
        title=_GUARANTEE_LABEL[g.kind],
        literal_text=None,
        category="garantias",
        requirement_type="excluyente",
        envelope="A" if g.kind == "provisional" else "requerimiento",
        required_value=value,
        sort_order=order,
    )


def _criterion_row(
    c: OfferAwardingCriterion,
    order: int,
) -> RequirementRow:
    literal = c.description if not c.note else f"{c.description}\n\n{c.note}"
    return RequirementRow(
        source_key=c.source_key,
        title=_short(_lot_prefix(c.lot_id) + c.description),
        literal_text=literal,
        category="criterio_adjudicacion",
        requirement_type="puntuable",
        envelope=_criterion_envelope(c),
        required_value=f"{format_number(c.weight)} puntos" if c.weight is not None else None,
        sort_order=order,
    )


def _criterion_envelope(c: OfferAwardingCriterion) -> str:
    return "B" if c.kind == "subjetivo" else "C"


def _deliverables(
    requirements: list[RequirementRow],
    criteria: list[OfferAwardingCriterion],
) -> list[DeliverableRow]:
    out: list[DeliverableRow] = []
    envelopes_used = {r.envelope for r in requirements}
    order = 0
    for envelope in ("A", "B", "C"):
        if envelope not in envelopes_used:
            continue
        order += 1
        own = [c for c in criteria if _criterion_envelope(c) == envelope]
        out.append(
            DeliverableRow(
                source_key=f"env:{envelope}",
                title=ENVELOPE_TITLES[envelope],
                envelope=envelope,
                points_max=_envelope_points(own),
                sort_order=order * 100,
            )
        )
        for child_order, criterion in enumerate(own, start=1):
            out.append(
                DeliverableRow(
                    source_key=f"env:{envelope}:{criterion.source_key}",
                    title=_short(_lot_prefix(criterion.lot_id) + criterion.description),
                    envelope=envelope,
                    points_max=criterion.weight,
                    sort_order=order * 100 + child_order,
                    parent_key=f"env:{envelope}",
                )
            )
    return out


def _envelope_points(criteria: list[OfferAwardingCriterion]) -> float | None:
    """Suma de pesos de un único ámbito (expediente o un lote); si hay varios lotes, sin total."""
    if not criteria:
        return None
    scopes = {c.lot_id for c in criteria}
    if None in scopes:
        scoped = [c for c in criteria if c.lot_id is None]
    elif len(scopes) == 1:
        scoped = criteria
    else:
        return None
    weights = [c.weight for c in scoped if c.weight is not None]
    return round(sum(weights), 2) if weights else None


def _milestones(extract: OfferIntakeExtract) -> list[MilestoneRow]:
    out: list[MilestoneRow] = []
    if extract.submission_deadline_at is not None:
        out.append(
            MilestoneRow(
                source_key="ms:presentacion",
                code="presentacion",
                title="Fin de plazo de presentación de ofertas",
                due_at=extract.submission_deadline_at,
                sort_order=10,
            )
        )
    if (
        extract.documents_available_until is not None
        and extract.documents_available_until != extract.submission_deadline_at
    ):
        out.append(
            MilestoneRow(
                source_key="ms:disponibilidad_pliegos",
                code="disponibilidad_pliegos",
                title="Fin de disponibilidad de pliegos",
                due_at=extract.documents_available_until,
                sort_order=20,
            )
        )
    return out


def _lot_prefix(lot_id: str | None) -> str:
    if lot_id is None:
        return ""
    return f"Lote {lot_id} · "


def _short(text: str, limit: int = TITLE_MAX) -> str:
    flat = " ".join(text.split())
    if len(flat) <= limit:
        return flat
    return flat[: limit - 1].rstrip() + "…"


def format_number(value: float | None) -> str:
    """Formato es-ES sin decimales superfluos: 313537.19 → ``313.537,19``; 60.0 → ``60``."""
    if value is None:
        return ""
    if float(value).is_integer():
        return f"{int(value):,}".replace(",", ".")
    text = f"{value:,.2f}"
    return text.replace(",", "_").replace(".", ",").replace("_", ".")
