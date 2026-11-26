"""Tests unitarios del purge de retención (ADR 031 / scripts/purge_tenders.py).

No requieren Postgres ni Storage: cubren escudos, include, limit, poda de emails,
paths RAW y el contrato SQL/workflow embebido en el script.
"""

from __future__ import annotations

import importlib.util
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID, uuid4

import pytest

ROOT = Path(__file__).resolve().parents[2]
_SPEC = importlib.util.spec_from_file_location(
    "purge_tenders",
    ROOT / "scripts" / "purge_tenders.py",
)
assert _SPEC is not None and _SPEC.loader is not None
purge = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(purge)


# ---------------------------------------------------------------------------
# storage_object_name
# ---------------------------------------------------------------------------


def test_storage_object_name_strips_raw_prefix() -> None:
    assert (
        purge.storage_object_name("raw/placsp/2026/01/01/entries/ab.atom.xml")
        == "placsp/2026/01/01/entries/ab.atom.xml"
    )


def test_storage_object_name_already_relative() -> None:
    assert purge.storage_object_name("placsp/x.json") == "placsp/x.json"


def test_storage_object_name_none_or_empty() -> None:
    assert purge.storage_object_name(None) is None
    assert purge.storage_object_name("") is None


# ---------------------------------------------------------------------------
# resolve_source_code / clamp_batch / limit
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (None, None),
        ("", None),
        ("   ", None),
        ("placsp_menores", "placsp_menores"),
        ("  catalunya  ", "catalunya"),
    ],
)
def test_resolve_source_code(raw: str | None, expected: str | None) -> None:
    assert purge.resolve_source_code(raw) == expected


def test_clamp_batch_bounds() -> None:
    assert purge.clamp_batch(0) == 1
    assert purge.clamp_batch(500) == 500
    assert purge.clamp_batch(5000) == 1000


def test_apply_deletable_limit() -> None:
    rows = [{"id": i} for i in range(10)]
    assert len(purge.apply_deletable_limit(rows, 0)) == 10
    assert len(purge.apply_deletable_limit(rows, 3)) == 3
    assert purge.apply_deletable_limit(rows, 3)[0]["id"] == 0


# ---------------------------------------------------------------------------
# Escudos (prioridad CASE)
# ---------------------------------------------------------------------------


def test_pick_shield_none_when_unprotected() -> None:
    assert purge.pick_shield() is None


def test_pick_shield_offer_wins_over_everything() -> None:
    assert (
        purge.pick_shield(
            in_offer=True,
            in_favorite=True,
            in_favorites_common=True,
            in_favorites_shared=True,
            in_recommendation=True,
            has_rating=True,
            alert_related_alive=True,
            open_or_null_deadline=True,
        )
        == "offer"
    )


def test_pick_shield_favorite_before_common() -> None:
    assert (
        purge.pick_shield(in_favorite=True, in_favorites_common=True)
        == "favorite"
    )


def test_pick_shield_favorites_and_recommendation() -> None:
    assert purge.pick_shield(in_favorites_common=True) == "favorites_common"
    assert purge.pick_shield(in_favorites_shared=True) == "favorites_shared"
    assert purge.pick_shield(in_recommendation=True) == "recommendation"


def test_pick_shield_rating() -> None:
    assert purge.pick_shield(has_rating=True) == "rating"


def test_pick_shield_alert_related() -> None:
    assert purge.pick_shield(alert_related_alive=True) == "alert_related"


def test_pick_shield_open_deadline() -> None:
    assert purge.pick_shield(open_or_null_deadline=True) == "open_deadline"


def test_pick_shield_priority_order() -> None:
    order = [
        ("offer", {"in_offer": True}),
        ("favorite", {"in_favorite": True}),
        ("favorites_common", {"in_favorites_common": True}),
        ("favorites_shared", {"in_favorites_shared": True}),
        ("recommendation", {"in_recommendation": True}),
        ("rating", {"has_rating": True}),
        ("alert_related", {"alert_related_alive": True}),
        ("open_deadline", {"open_or_null_deadline": True}),
    ]
    for name, kwargs in order:
        assert purge.pick_shield(**kwargs) == name


# ---------------------------------------------------------------------------
# Alerta viva / papelera 30 días
# ---------------------------------------------------------------------------


def test_alert_related_alive_without_trash() -> None:
    assert purge.alert_related_is_alive(None) is True


def test_alert_related_alive_in_trash_window() -> None:
    now = datetime(2026, 11, 16, tzinfo=timezone.utc)
    trashed = now - timedelta(days=10)
    assert purge.alert_related_is_alive(trashed, now=now) is True


def test_alert_related_dismiss_permanent_outside_window() -> None:
    now = datetime(2026, 11, 16, tzinfo=timezone.utc)
    trashed = now - timedelta(days=31)
    assert purge.alert_related_is_alive(trashed, now=now) is False


def test_alert_related_boundary_exactly_30_days_not_alive() -> None:
    """SQL usa ``trashed_at > now() - 30 days`` (estricto)."""
    now = datetime(2026, 11, 16, tzinfo=timezone.utc)
    trashed = now - timedelta(days=30)
    assert purge.alert_related_is_alive(trashed, now=now) is False


# ---------------------------------------------------------------------------
# Include por deadline
# ---------------------------------------------------------------------------


def test_include_rejects_null_deadline() -> None:
    assert purge.deadline_is_include_candidate(None, months=3) is False


def test_include_rejects_future_deadline() -> None:
    now = datetime(2026, 11, 16, tzinfo=timezone.utc)
    future = now + timedelta(days=10)
    assert (
        purge.deadline_is_include_candidate(future, now=now, months=3) is False
    )


def test_include_accepts_old_deadline() -> None:
    now = datetime(2026, 11, 16, tzinfo=timezone.utc)
    old = now - timedelta(days=120)
    assert purge.deadline_is_include_candidate(old, now=now, months=3) is True


def test_include_rejects_recently_closed() -> None:
    now = datetime(2026, 11, 16, tzinfo=timezone.utc)
    recent = now - timedelta(days=20)
    assert (
        purge.deadline_is_include_candidate(recent, now=now, months=3) is False
    )


# ---------------------------------------------------------------------------
# partition / emails / artifacts
# ---------------------------------------------------------------------------


def test_partition_by_shield() -> None:
    rows = [
        {"id": "a", "shield": "offer"},
        {"id": "b", "shield": None},
        {"id": "c", "shield": "favorite"},
        {"id": "d", "shield": ""},  # falsy → borrable
    ]
    protected, deletable, counts = purge.partition_by_shield(rows)
    assert {r["id"] for r in protected} == {"a", "c"}
    assert {r["id"] for r in deletable} == {"b", "d"}
    assert counts["offer"] == 1
    assert counts["favorite"] == 1


def test_prune_email_noop() -> None:
    t1, t2 = uuid4(), uuid4()
    action, new = purge.prune_email_tender_ids([t1, t2], {uuid4()})
    assert action == "noop"
    assert new == [t1, t2]


def test_prune_email_update_partial() -> None:
    t1, t2, t3 = uuid4(), uuid4(), uuid4()
    action, new = purge.prune_email_tender_ids([t1, t2, t3], {t2})
    assert action == "update"
    assert new == [t1, t3]


def test_prune_email_delete_when_empty() -> None:
    t1 = uuid4()
    action, new = purge.prune_email_tender_ids([t1], {t1})
    assert action == "delete"
    assert new == []


def test_prune_email_none_existing() -> None:
    action, new = purge.prune_email_tender_ids(None, {uuid4()})
    assert action == "noop"
    assert new == []


def test_orphan_artifact_ids() -> None:
    a, b, c = uuid4(), uuid4(), uuid4()
    assert purge.orphan_artifact_ids([a, b, c], {b}) == [a, c]


# ---------------------------------------------------------------------------
# Contrato SQL / ADR embebido (regresión si alguien rompe el CASE)
# ---------------------------------------------------------------------------


def test_candidates_sql_lists_all_shields_and_tables() -> None:
    sql = purge.CANDIDATES_SQL
    for token in (
        "offer_cases",
        "favorites",
        "favorites_common",
        "favorites_shared",
        "tender_recommendations",
        "tender_ratings",
        "notification_queue",
        "alert_related_trash",
        "'offer'",
        "'favorite'",
        "'favorites_common'",
        "'favorites_shared'",
        "'recommendation'",
        "'rating'",
        "'alert_related'",
        "'open_deadline'",
        "make_interval(months => %(months)s)",
        "tender_sources",
    ):
        assert token in sql, f"falta {token} en CANDIDATES_SQL"
    assert "shared_favorites" not in sql


def test_build_candidates_sql_omits_missing_offer_cases() -> None:
    tables = {
        "favorites",
        "favorites_common",
        "tender_ratings",
        "notification_queue",
        "alert_related_trash",
    }
    sql = purge.build_candidates_sql(tables)
    assert "offer_cases" not in sql
    assert "'offer'" not in sql
    assert "favorites" in sql
    assert "'open_deadline'" in sql


def test_build_candidates_sql_includes_recommendations() -> None:
    sql = purge.build_candidates_sql({"tender_recommendations"})
    assert "public.tender_recommendations" in sql
    assert "'recommendation'" in sql
    assert "shared_favorites" not in sql


def test_build_candidates_sql_alert_without_trash_table() -> None:
    sql = purge.build_candidates_sql({"notification_queue"})
    assert "notification_queue" in sql
    assert "alert_related_trash" not in sql
    assert "'alert_related'" in sql


def test_emails_sql_uses_array_overlap() -> None:
    assert "tender_ids &&" in purge.EMAILS_TOUCHING_SQL
    assert "notification_emails" in purge.EMAILS_TOUCHING_SQL


def test_workflow_yaml_defaults() -> None:
    text = (ROOT / ".github" / "workflows" / "cleanup-tenders.yml").read_text(
        encoding="utf-8"
    )
    assert "workflow_dispatch" in text
    assert "dry-run" in text
    assert "min_deadline_age_months" in text
    assert 'default: "3"' in text
    assert "source_code" in text
    assert "purge_tenders.py" in text
    assert "\nschedule:" not in text
    assert " schedule:" not in text


def test_adr_031_exists() -> None:
    adr = ROOT / "docs" / "adr" / "031-retencion-purge-tenders.md"
    assert adr.is_file()
    body = adr.read_text(encoding="utf-8")
    assert "Escudos" in body or "escudos" in body
    assert "dry-run" in body
