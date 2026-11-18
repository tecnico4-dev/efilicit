"""Dedupe de recomendaciones: una fila por tender."""

from __future__ import annotations

from efilicit_ingestion.recommendations.dedupe import (
    dedupe_recommendations_by_tender,
)
from efilicit_ingestion.recommendations.models import Recommendation


def test_dedupe_keeps_higher_score_kind() -> None:
    by_profile = {
        "propia": [
            Recommendation("t1", "propia", 0.9, {"label": "a"}),
            Recommendation("t2", "propia", 0.5, {}),
        ],
        "subcontrata": [
            Recommendation("t1", "subcontrata", 0.7, {"label": "b"}),
            Recommendation("t3", "subcontrata", 0.6, {}),
        ],
    }
    out = dedupe_recommendations_by_tender(by_profile)
    by_id = {r.tender_id: r for r in out}
    assert set(by_id) == {"t1", "t2", "t3"}
    assert by_id["t1"].profile_kind == "propia"
    assert by_id["t1"].score == 0.9
    assert by_id["t2"].profile_kind == "propia"
    assert by_id["t3"].profile_kind == "subcontrata"


def test_dedupe_tie_sets_kind_null() -> None:
    by_profile = {
        "propia": [Recommendation("t1", "propia", 0.8, {"label": "a"})],
        "subcontrata": [
            Recommendation("t1", "subcontrata", 0.8, {"label": "b"})
        ],
    }
    out = dedupe_recommendations_by_tender(by_profile)
    assert len(out) == 1
    assert out[0].tender_id == "t1"
    assert out[0].profile_kind is None
    assert out[0].score == 0.8
    assert out[0].reason.get("tie_profiles") is True
