"""Puntuación de candidatas (ADR 034).

Pesos: CPV 0.40 + texto 0.40 + tipo 0.10 + importe 0.10
+ boost empresa + entrada por encaje fuerte empresa
− penalización semillas negativas.
Umbral: no se rellena un top-N flojo.
"""

from __future__ import annotations

import math
import re
from decimal import Decimal

from efilicit_ingestion.recommendations.company_profile import company_fit_score
from efilicit_ingestion.recommendations.models import (
    CandidateTender,
    ProfileKind,
    Recommendation,
    Seed,
)

W_CPV = 0.40
W_TEXT = 0.40
W_TYPE = 0.10
W_AMOUNT = 0.10
W_COMPANY_BOOST = 0.22
PENALTY_NEG = 0.30

# Encaje empresa suficiente para entrar aunque el score personal sea bajo
COMPANY_ENTRY_MIN = 0.62
# Score final mínimo para persistir / mostrar
SCORE_THRESHOLD = 0.42
# Tope de seguridad por perfil (no es un cupo de relleno)
MAX_PER_PROFILE = 80


def cpv_prefix_score(a: str, b: str) -> float:
    """Similitud por prefijo CPV (exacto 8 → 1.0 … 3 → 0.3)."""
    da = re.sub(r"\D", "", a)
    db = re.sub(r"\D", "", b)
    if not da or not db:
        return 0.0
    n = 0
    for x, y in zip(da, db, strict=False):
        if x != y:
            break
        n += 1
    return {8: 1.0, 7: 0.9, 6: 0.8, 5: 0.75, 4: 0.5, 3: 0.3}.get(n, 0.0)


def best_cpv_vs_seeds(
    candidate_cpvs: tuple[str, ...] | list[str],
    seeds: list[Seed],
) -> tuple[float, str | None, str | None]:
    """Mejor CPV×peso_semilla; devuelve (score, seed_id, cpv)."""
    best = 0.0
    best_seed: str | None = None
    best_cpv: str | None = None
    for seed in seeds:
        for sc in seed.cpv_codes:
            for cc in candidate_cpvs:
                raw = cpv_prefix_score(cc, sc) * seed.weight
                if raw > best:
                    best = raw
                    best_seed = seed.tender_id
                    best_cpv = cc
    return best, best_seed, best_cpv


def contract_type_score(
    candidate_type: str | None, seeds: list[Seed]
) -> float:
    typed = [s for s in seeds if s.contract_type]
    if not typed or not candidate_type:
        return 0.5
    same = sum(1 for s in typed if s.contract_type == candidate_type)
    return same / len(typed)


def _log_value(v: Decimal) -> float:
    return math.log10(float(v) + 1.0)


def amount_band_score(
    value: Decimal | None, seeds: list[Seed]
) -> float:
    vals = [s.estimated_value for s in seeds if s.estimated_value is not None]
    if value is None:
        return 0.5
    if not vals:
        return 0.5
    logs = sorted(_log_value(v) for v in vals)
    if len(logs) == 1:
        # Cerca del único valor
        d = abs(_log_value(value) - logs[0])
        return max(0.0, 1.0 - d)
    # p10–p90 aproximado
    lo = logs[max(0, int(0.1 * (len(logs) - 1)))]
    hi = logs[min(len(logs) - 1, int(0.9 * (len(logs) - 1)))]
    x = _log_value(value)
    if lo <= x <= hi:
        return 1.0
    # Distancia fuera de banda
    dist = lo - x if x < lo else x - hi
    return max(0.0, 1.0 - dist)


def negative_penalty(
    candidate: CandidateTender, negatives: list[Seed]
) -> float:
    if not negatives:
        return 0.0
    best = 0.0
    for seed in negatives:
        cpv_s, _, _ = best_cpv_vs_seeds(candidate.cpv_codes, [seed])
        # title_similarity ya viene de SQL vs semillas; aquí aproximamos con CPV
        best = max(best, cpv_s * seed.weight)
    return min(1.0, best)


def score_candidate(
    candidate: CandidateTender,
    *,
    profile: ProfileKind,
    positive_seeds: list[Seed],
    negative_seeds: list[Seed],
) -> Recommendation | None:
    """Devuelve Recommendation si supera umbral; si no, None."""
    cpv_s, seed_id, matched_cpv = best_cpv_vs_seeds(
        candidate.cpv_codes, positive_seeds
    )
    # Texto: combinación rank FTS (0..?) y similarity título (0..1)
    text_s = min(
        1.0,
        0.55 * min(1.0, candidate.text_rank * 2.0)
        + 0.45 * max(0.0, min(1.0, candidate.title_similarity)),
    )
    type_s = contract_type_score(candidate.contract_type, positive_seeds)
    amount_s = amount_band_score(candidate.estimated_value, positive_seeds)

    personal = (
        W_CPV * cpv_s
        + W_TEXT * text_s
        + W_TYPE * type_s
        + W_AMOUNT * amount_s
    )

    company, company_parts = company_fit_score(
        profile=profile,
        cpv_codes=candidate.cpv_codes,
        title=candidate.title,
        description=candidate.description,
        estimated_value=candidate.estimated_value,
    )

    penalty = PENALTY_NEG * negative_penalty(candidate, negative_seeds)
    boosted = personal + W_COMPANY_BOOST * company - penalty

    # Entrada por empresa fuerte aunque personal sea flojo
    company_entry = company >= COMPANY_ENTRY_MIN
    if company_entry and boosted < SCORE_THRESHOLD:
        # Eleva hasta umbral + margen pequeño si el encaje empresa es alto
        boosted = max(boosted, SCORE_THRESHOLD + 0.02 * (company - COMPANY_ENTRY_MIN))

    if not positive_seeds and not company_entry:
        return None

    if boosted < SCORE_THRESHOLD and not (
        company_entry and company >= COMPANY_ENTRY_MIN
    ):
        return None

    # Dominante
    parts = {
        "cpv": cpv_s,
        "text": text_s,
        "type": type_s,
        "amount": amount_s,
        "company": company,
    }
    dominant = max(parts, key=parts.get)
    reason = {
        "dominant": dominant,
        "personal": round(personal, 4),
        "company": round(company, 4),
        "company_parts": company_parts,
        "seed_tender_id": seed_id,
        "matched_cpv": matched_cpv,
        "company_entry": company_entry and personal < SCORE_THRESHOLD,
        "label": _reason_label(
            dominant=dominant,
            matched_cpv=matched_cpv,
            company_entry=company_entry and personal < SCORE_THRESHOLD,
            seed_title=_seed_title(positive_seeds, seed_id),
            candidate_title=candidate.title,
        ),
    }

    final = max(0.0, min(0.9999, boosted))
    if final < SCORE_THRESHOLD:
        return None

    return Recommendation(
        tender_id=candidate.tender_id,
        profile_kind=profile,
        score=round(final, 4),
        reason=reason,
    )


def _seed_title(seeds: list[Seed], seed_id: str | None) -> str:
    if not seed_id:
        return ""
    for s in seeds:
        if s.tender_id == seed_id:
            return s.title
    return ""


def _reason_label(
    *,
    dominant: str,
    matched_cpv: str | None,
    company_entry: bool,
    seed_title: str,
    candidate_title: str,
) -> str:
    if company_entry:
        return "Encaja con el perfil Eficen"
    short = (seed_title or candidate_title)[:48]
    if dominant == "cpv" and matched_cpv:
        digits = re.sub(r"\D", "", matched_cpv)[:8]
        if short:
            return f"CPV {digits} como en «{short}»"
        return f"CPV {digits}"
    if dominant == "text" and short:
        return f"Título parecido a «{short}»"
    if dominant == "company":
        return "Encaja con el perfil Eficen"
    if short:
        return f"Parecida a «{short}»"
    return "Recomendada según tu interés"


def rank_candidates(
    candidates: list[CandidateTender],
    *,
    profile: ProfileKind,
    positive_seeds: list[Seed],
    negative_seeds: list[Seed],
) -> list[Recommendation]:
    out: list[Recommendation] = []
    for c in candidates:
        rec = score_candidate(
            c,
            profile=profile,
            positive_seeds=positive_seeds,
            negative_seeds=negative_seeds,
        )
        if rec is not None:
            out.append(rec)
    out.sort(key=lambda r: r.score, reverse=True)
    return out[:MAX_PER_PROFILE]
