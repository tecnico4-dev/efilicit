"""Tests de semillas de recomendaciones (sin Postgres)."""

from __future__ import annotations

from decimal import Decimal

from efilicit_ingestion.recommendations.seeds import (
    FavoriteRow,
    OfferCaseRow,
    RatingRow,
    build_seeds_for_profile,
    count_personal_seeds,
)


def test_separates_propia_and_subcontrata() -> None:
    ratings = [
        RatingRow("t1", 5, "propia", title="A"),
        RatingRow("t2", 5, "subcontrata", title="B"),
    ]
    pos_p, _ = build_seeds_for_profile(
        "propia",
        ratings=ratings,
        own_favorites=[],
        common_favorites=[],
        peer_shares=[],
        offer_cases=[],
    )
    pos_s, _ = build_seeds_for_profile(
        "subcontrata",
        ratings=ratings,
        own_favorites=[],
        common_favorites=[],
        peer_shares=[],
        offer_cases=[],
    )
    assert [s.tender_id for s in pos_p] == ["t1"]
    assert [s.tender_id for s in pos_s] == ["t2"]


def test_ignores_null_kind_and_star_3() -> None:
    ratings = [
        RatingRow("t1", 5, None),
        RatingRow("t2", 3, "propia"),
        RatingRow("t3", 4, "propia"),
    ]
    pos, neg = build_seeds_for_profile(
        "propia",
        ratings=ratings,
        own_favorites=[],
        common_favorites=[],
        peer_shares=[],
        offer_cases=[],
    )
    assert [s.tender_id for s in pos] == ["t3"]
    assert neg == []


def test_negative_stars() -> None:
    ratings = [
        RatingRow("t1", 1, "propia"),
        RatingRow("t2", 2, "propia"),
    ]
    pos, neg = build_seeds_for_profile(
        "propia",
        ratings=ratings,
        own_favorites=[],
        common_favorites=[],
        peer_shares=[],
        offer_cases=[],
    )
    assert pos == []
    assert {s.tender_id for s in neg} == {"t1", "t2"}


def test_favorite_and_rating_dedupe_with_bonus() -> None:
    ratings = [RatingRow("t1", 4, "propia", title="X")]
    favs = [FavoriteRow("t1", "propia", title="X")]
    pos, _ = build_seeds_for_profile(
        "propia",
        ratings=ratings,
        own_favorites=favs,
        common_favorites=[],
        peer_shares=[],
        offer_cases=[],
    )
    assert len(pos) == 1
    assert pos[0].weight == 0.9  # 0.8 + 0.1


def test_favorite_alone_weight() -> None:
    favs = [FavoriteRow("t1", "propia")]
    pos, _ = build_seeds_for_profile(
        "propia",
        ratings=[],
        own_favorites=favs,
        common_favorites=[],
        peer_shares=[],
        offer_cases=[],
    )
    assert pos[0].weight == 0.8
    assert pos[0].source == "favorite"


def test_common_and_offer_lower_weight() -> None:
    common = [FavoriteRow("c1", "propia", title="Común")]
    offers = [
        OfferCaseRow("o1", "adjudicada", kind="propia", title="Adj"),
        OfferCaseRow("o2", "descartada", kind="propia", title="No"),
        OfferCaseRow("o3", "adjudicada", kind="subcontrata", title="Sub"),
    ]
    pos_p, _ = build_seeds_for_profile(
        "propia",
        ratings=[],
        own_favorites=[],
        common_favorites=common,
        peer_shares=[],
        offer_cases=offers,
    )
    pos_s, _ = build_seeds_for_profile(
        "subcontrata",
        ratings=[],
        own_favorites=[],
        common_favorites=[],
        peer_shares=[],
        offer_cases=offers,
    )
    ids_p = {s.tender_id: s for s in pos_p}
    assert "c1" in ids_p and ids_p["c1"].weight == 0.45
    assert "o1" in ids_p and ids_p["o1"].weight == 0.85
    assert "o2" not in ids_p
    assert [s.tender_id for s in pos_s] == ["o3"]


def test_empty_optional_sources_produce_no_seeds() -> None:
    """Sin común/compartidas/histórico no se inventan semillas de esas fuentes."""
    pos, neg = build_seeds_for_profile(
        "propia",
        ratings=[],
        own_favorites=[],
        common_favorites=[],
        peer_shares=[],
        offer_cases=[],
    )
    assert pos == []
    assert neg == []


def test_count_personal_seeds() -> None:
    ratings = [RatingRow("t1", 5, "propia")]
    common = [FavoriteRow("c1", "propia")]
    pos, _ = build_seeds_for_profile(
        "propia",
        ratings=ratings,
        own_favorites=[],
        common_favorites=common,
        peer_shares=[],
        offer_cases=[],
    )
    assert count_personal_seeds(pos) == 1
