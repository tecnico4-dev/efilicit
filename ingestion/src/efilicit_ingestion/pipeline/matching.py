"""Matching multi-fuente de licitaciones (Semana 4 Paso 5).

Anota cada ``SourceRecord`` con ``payload['match']``; aún no fusiona filas
(eso es Paso 6 / upsert). El lookup consulta el canónico ya persistido de
*otras* fuentes. En ``pending``, el candidato best llega a
``tender_sources.match_candidate_tender_id`` (ADR 010).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from difflib import SequenceMatcher
from typing import Any, Protocol

from efilicit_ingestion.models import SourceRecord

REVIEW_UNMATCHED = "unmatched"
REVIEW_AUTO = "auto"
REVIEW_PENDING = "pending"

METHOD_EXPEDIENTE_TAX_ID = "expediente_tax_id"
METHOD_TAX_ID_SIGNALS = "tax_id_signals"
METHOD_SIGNAL_BUNDLE = "signal_bundle"
METHOD_TITLE_SIMILARITY = "title_similarity"


@dataclass(frozen=True, slots=True)
class MatchCandidate:
    """Licitación ya persistida bajo un ``source_code`` distinto."""

    tender_id: str
    source_code: str
    source_tender_id: str
    title: str | None = None
    tax_id: str | None = None
    expediente: str | None = None
    cpv_code: str | None = None
    estimated_value: Decimal | None = None
    publication_date: date | None = None


class MatchLookup(Protocol):
    """API mínima de lectura para matching multi-fuente."""

    def find_match_candidates(
        self,
        *,
        exclude_source_code: str,
        tax_id: str | None = None,
        expediente: str | None = None,
        cpv_code: str | None = None,
        limit: int = 50,
    ) -> list[MatchCandidate]:
        """Candidatos de fuentes distintas a ``exclude_source_code``."""
        ...


@dataclass(frozen=True, slots=True)
class _ScoredMatch:
    candidate: MatchCandidate
    review_status: str
    match_method: str
    match_score: float


def extract_expediente(record: SourceRecord) -> str | None:
    """Expediente desde payload / canónico / ids estilo ``tax:EXP``."""
    raw = record.payload or {}
    for key in ("contract_folder_id", "codi_expedient", "expediente"):
        value = raw.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()

    canonical = raw.get("canonical") or {}
    for key in ("contract_folder_id", "expediente"):
        value = canonical.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()

    source_tender_id = (
        canonical.get("source_tender_id") or record.source_record_id or ""
    )
    return expediente_from_source_tender_id(str(source_tender_id))


def expediente_from_source_tender_id(source_tender_id: str) -> str | None:
    """Estilo PLACSP ``{tax|platform}:{ContractFolderID}`` → id de expediente."""
    text = source_tender_id.strip()
    if ":" not in text:
        return None
    _, _, rest = text.partition(":")
    rest = rest.strip()
    return rest or None


def title_similarity(a: str | None, b: str | None) -> float:
    """Similitud de título (SequenceMatcher); 0 si falta alguno."""
    if not a or not b:
        return 0.0
    left = " ".join(a.casefold().split())
    right = " ".join(b.casefold().split())
    if not left or not right:
        return 0.0
    return SequenceMatcher(None, left, right).ratio()


def match_records(
    records: list[SourceRecord],
    *,
    source_code: str,
    lookup: MatchLookup | None = None,
) -> list[SourceRecord]:
    """Adjunta ``payload['match']`` con lookup multi-fuente si hay repo."""
    if lookup is None:
        return [_annotate(record, _unmatched()) for record in records]
    return [
        _annotate(record, _decide(record, source_code=source_code, lookup=lookup))
        for record in records
    ]


def _decide(
    record: SourceRecord,
    *,
    source_code: str,
    lookup: MatchLookup,
) -> dict[str, Any]:
    canonical = (record.payload or {}).get("canonical") or {}
    authority = canonical.get("authority") or {}
    tax_id = authority.get("tax_id")
    expediente = extract_expediente(record)
    cpv_code = canonical.get("cpv_code")
    title = canonical.get("title")
    estimated_value = canonical.get("estimated_value")
    publication_date = _as_date(canonical.get("publication_date"))

    candidates = lookup.find_match_candidates(
        exclude_source_code=source_code,
        tax_id=tax_id,
        expediente=expediente,
        cpv_code=cpv_code,
        limit=50,
    )
    if not candidates:
        return _unmatched()

    scored: list[_ScoredMatch] = []
    for candidate in candidates:
        scored_one = _score_against(
            candidate,
            tax_id=tax_id,
            expediente=expediente,
            title=title,
            cpv_code=cpv_code,
            estimated_value=estimated_value,
            publication_date=publication_date,
        )
        if scored_one is not None:
            scored.append(scored_one)

    if not scored:
        return _unmatched()

    autos = [s for s in scored if s.review_status == REVIEW_AUTO]
    if len(autos) == 1:
        return _from_scored(autos[0])
    if len(autos) > 1:
        # Varios auto empatados → no fusionar; dejar pending sin target único.
        best = max(autos, key=lambda s: s.match_score)
        return {
            "review_status": REVIEW_PENDING,
            "match_method": best.match_method,
            "match_score": round(best.match_score, 4),
            "matched_tender_id": None,
            "reason": "ambiguous_auto_candidates",
        }

    pendings = [s for s in scored if s.review_status == REVIEW_PENDING]
    if pendings:
        # Candidato best informativo (ADR 010); upsert no fusiona.
        best = max(pendings, key=lambda s: s.match_score)
        return {
            "review_status": REVIEW_PENDING,
            "match_method": best.match_method,
            "match_score": round(best.match_score, 4),
            "matched_tender_id": best.candidate.tender_id,
            "reason": "insufficient_confidence",
        }
    return _unmatched()


def _score_against(
    candidate: MatchCandidate,
    *,
    tax_id: str | None,
    expediente: str | None,
    title: str | None,
    cpv_code: str | None,
    estimated_value: Decimal | None,
    publication_date: date | None,
) -> _ScoredMatch | None:
    tax_match = bool(tax_id and candidate.tax_id and tax_id == candidate.tax_id)
    exp_match = bool(
        expediente and candidate.expediente and expediente == candidate.expediente
    )
    sim = title_similarity(title, candidate.title)
    cpv_match = bool(cpv_code and candidate.cpv_code and cpv_code == candidate.cpv_code)
    amount_match = _amounts_close(estimated_value, candidate.estimated_value)
    date_match = bool(
        publication_date
        and candidate.publication_date
        and publication_date == candidate.publication_date
    )
    signal_hits = sum((cpv_match, amount_match, date_match, sim >= 0.85))

    # Nivel 2 — expediente + NIF/CIF del organismo (nunca solo el nombre).
    if tax_match and exp_match:
        return _ScoredMatch(
            candidate=candidate,
            review_status=REVIEW_AUTO,
            match_method=METHOD_EXPEDIENTE_TAX_ID,
            match_score=1.0,
        )

    # Nivel 3 — NIF/CIF + señales de refuerzo (sigue sin usar el nombre como id).
    if tax_match and signal_hits >= 2:
        return _ScoredMatch(
            candidate=candidate,
            review_status=REVIEW_AUTO,
            match_method=METHOD_TAX_ID_SIGNALS,
            match_score=min(0.95, 0.75 + 0.05 * signal_hits + 0.1 * sim),
        )

    # Baja confianza / ambiguo → pending (no auto-fusionar).
    if exp_match and not tax_match:
        return _ScoredMatch(
            candidate=candidate,
            review_status=REVIEW_PENDING,
            match_method=METHOD_SIGNAL_BUNDLE,
            match_score=0.55,
        )
    if tax_match and signal_hits >= 1:
        return _ScoredMatch(
            candidate=candidate,
            review_status=REVIEW_PENDING,
            match_method=METHOD_TAX_ID_SIGNALS,
            match_score=0.6 + 0.05 * signal_hits,
        )
    if signal_hits >= 3 or sim >= 0.92:
        return _ScoredMatch(
            candidate=candidate,
            review_status=REVIEW_PENDING,
            match_method=METHOD_TITLE_SIMILARITY if sim >= 0.92 else METHOD_SIGNAL_BUNDLE,
            match_score=max(0.5, sim if sim >= 0.92 else 0.5 + 0.05 * signal_hits),
        )
    return None


def _amounts_close(a: Decimal | None, b: Decimal | None) -> bool:
    """Importes cercanos (tolerancia relativa 1 %)."""
    if a is None or b is None:
        return False
    try:
        left = Decimal(a)
        right = Decimal(b)
    except Exception:  # noqa: BLE001
        return False
    if left == right:
        return True
    base = max(abs(left), abs(right), Decimal("1"))
    return abs(left - right) / base <= Decimal("0.01")


def _as_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def _unmatched() -> dict[str, Any]:
    return {
        "review_status": REVIEW_UNMATCHED,
        "match_method": None,
        "match_score": None,
        "matched_tender_id": None,
    }


def _from_scored(scored: _ScoredMatch) -> dict[str, Any]:
    return {
        "review_status": scored.review_status,
        "match_method": scored.match_method,
        "match_score": round(scored.match_score, 4),
        "matched_tender_id": scored.candidate.tender_id,
    }


def _annotate(record: SourceRecord, match: dict[str, Any]) -> SourceRecord:
    payload = dict(record.payload or {})
    payload["match"] = match
    return record.model_copy(update={"payload": payload})
