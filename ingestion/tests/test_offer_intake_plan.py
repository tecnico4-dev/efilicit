from __future__ import annotations

from pathlib import Path

from efilicit_ingestion.offer_intake.placsp_terms import parse_offer_terms
from efilicit_ingestion.offer_intake.plan import (
    build_intake_plan,
    format_number,
    target_lot_ids,
)

FIXTURE = Path(__file__).parent / "fixtures" / "placsp" / "offer_terms_entry.atom"


def _plan(target_lots: set[str] | None = None):
    return build_intake_plan(parse_offer_terms(FIXTURE.read_bytes()), target_lots=target_lots or ())


def test_pliegos_keep_link_and_initial_fetch_status() -> None:
    plan = _plan()

    statuses = {p.title: p.initial_fetch_status for p in plan.pliegos}
    assert statuses["PCAP alumbrado.pdf"] == "pendiente"
    assert statuses["Memoria justificativa"] == "solo_enlace"
    assert all(p.url == p.source_uri for p in plan.pliegos)


def test_requirements_categories_envelopes_and_values() -> None:
    plan = _plan()
    by_key = {r.source_key: r for r in plan.requirements}

    eco = next(r for r in plan.requirements if r.category == "solvencia_economica")
    assert eco.envelope == "A"
    assert eco.requirement_type == "excluyente"
    assert eco.required_value == "Umbral: 313.537,19"
    assert eco.title.startswith("Solvencia económica: ")

    guarantee = next(r for r in plan.requirements if r.category == "garantias")
    assert guarantee.title == "Garantía definitiva"
    assert guarantee.envelope == "requerimiento"
    assert guarantee.required_value == "5 %"

    subj = next(r for r in plan.requirements if r.envelope == "B")
    assert subj.requirement_type == "puntuable"
    assert subj.required_value == "25 puntos"

    lot_crit = by_key["crit:1:1"]
    assert lot_crit.title == "Lote 1 · Precio lote 1"
    assert lot_crit.envelope == "C"

    assert len(by_key) == len(plan.requirements)
    assert [r.sort_order for r in plan.requirements] == list(range(1, len(plan.requirements) + 1))


def test_deliverables_group_criteria_by_envelope() -> None:
    plan = _plan()
    by_key = {d.source_key: d for d in plan.deliverables}

    assert [d.source_key for d in plan.deliverables if d.parent_key is None] == [
        "env:A",
        "env:B",
        "env:C",
    ]
    # Totales del ámbito expediente (el criterio del lote 1 no suma al total).
    assert by_key["env:B"].points_max == 25.0
    assert by_key["env:C"].points_max == 75.0
    assert by_key["env:A"].points_max is None

    children_c = [d for d in plan.deliverables if d.parent_key == "env:C"]
    assert len(children_c) == 3
    assert all(d.source_key.startswith("env:C:crit:") for d in children_c)


def test_target_lots_filter_lot_scoped_items() -> None:
    plan = _plan({"2"})

    assert "crit:1:1" not in {r.source_key for r in plan.requirements}
    assert any(r.source_key.startswith("crit:-:") for r in plan.requirements)


def test_milestones_from_deadlines() -> None:
    plan = _plan()

    assert [(m.code, m.due_at.isoformat()) for m in plan.milestones] == [
        ("presentacion", "2026-12-09T10:00:00+01:00"),
        ("disponibilidad_pliegos", "2026-12-07T10:00:00+01:00"),
    ]


def test_target_lot_ids_accepts_objects_and_strings() -> None:
    assert target_lot_ids([{"id": "1", "label": "Norte"}, "2", {"label": "x"}, " "]) == {"1", "2"}
    assert target_lot_ids(None) == set()


def test_format_number_es() -> None:
    assert format_number(313537.19) == "313.537,19"
    assert format_number(60.0) == "60"
    assert format_number(1234567.0) == "1.234.567"
