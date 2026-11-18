"""Una recomendación por tender: gana el mayor score; empate → kind null."""

from __future__ import annotations

from efilicit_ingestion.recommendations.models import Recommendation


def dedupe_recommendations_by_tender(
    by_profile: dict[str, list[Recommendation]],
) -> list[Recommendation]:
    """Fusiona rankings por perfil en una lista sin tender_id repetido.

    - Mayor score gana (conserva su profile_kind).
    - Empate de score entre perfiles → profile_kind None.
    """
    best: dict[str, Recommendation] = {}
    tied: set[str] = set()

    for rows in by_profile.values():
        for rec in rows:
            prev = best.get(rec.tender_id)
            if prev is None:
                best[rec.tender_id] = rec
                continue
            if rec.score > prev.score:
                best[rec.tender_id] = rec
                tied.discard(rec.tender_id)
            elif rec.score < prev.score:
                continue
            else:
                # Mismo score, otro perfil (o el mismo): marcar empate.
                if rec.profile_kind != prev.profile_kind:
                    tied.add(rec.tender_id)

    out: list[Recommendation] = []
    for tid, rec in best.items():
        if tid in tied:
            reason = dict(rec.reason)
            reason["tie_profiles"] = True
            out.append(
                Recommendation(
                    tender_id=rec.tender_id,
                    profile_kind=None,
                    score=rec.score,
                    reason=reason,
                )
            )
        else:
            out.append(rec)
    out.sort(key=lambda r: r.score, reverse=True)
    return out
