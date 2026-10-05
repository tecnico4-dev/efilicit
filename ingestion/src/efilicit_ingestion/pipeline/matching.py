"""Matching multi-fuente de licitaciones (Semana 4 Paso 5).

Una misma licitación puede llegar por PLACSP, Catalunya, Euskadi, etc.
Este módulo decide si el registro nuevo apunta a un ``tenders.id`` ya
existente de *otra* fuente, o si debe quedarse aparte.

Flujo:

1. Anota ``payload['match']`` (``review_status``, método, score, candidato).
2. **No** fusiona filas aquí: eso lo hace el upsert (Paso 6) leyendo ese payload.
3. El lookup consulta el canónico ya persistido; un lote ciego no ve otras fuentes.

Estados:

- ``auto`` — confianza alta → el upsert reutiliza el ``tenders.id``.
- ``pending`` — hay indicios pero no bastan → fila nueva + candidato best
  en ``tender_sources.match_candidate_tender_id`` (ADR 010; solo informativo).
- ``unmatched`` — sin candidato usable.

Regla de producto: el **nombre del organismo nunca** es identidad única;
la señal primaria es NIF/CIF (``tax_id``) + expediente cuando exista.
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
    """Licitación ya persistida bajo un ``source_code`` distinto al que se ingiere.

    Lleva las señales que el scorer compara (NIF, expediente, CPV, importe, fecha, título).
    """

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
    """Contrato de lectura que implementa el repo canónico (memoria o Postgres).

    Sirve para no acoplar el algoritmo de score a SQL ni a la estructura interna del repo.
    """

    def find_match_candidates(
        self,
        *,
        exclude_source_code: str,
        tax_id: str | None = None,
        expediente: str | None = None,
        cpv_code: str | None = None,
        limit: int = 50,
    ) -> list[MatchCandidate]:
        """Prefiltra candidatos de fuentes ≠ ``exclude_source_code``.

        Sin al menos un filtro (NIF / expediente / CPV) el repo no debería
        devolver el catálogo entero: el match se hace sobre un subconjunto acotado.
        """
        ...


@dataclass(frozen=True, slots=True)
class _ScoredMatch:
    """Resultado de puntuar un candidato concreto (aún no es la decisión final del lote)."""

    candidate: MatchCandidate
    review_status: str
    match_method: str
    match_score: float


def extract_expediente(record: SourceRecord) -> str | None:
    """Obtiene el id de expediente con varias formas de campo según la fuente.

    Orden: claves crudas del parser → bloque ``canonical`` → sufijo de
    ``source_tender_id`` estilo PLACSP (``tax:EXP`` / ``platform:EXP``).
    Sin expediente estable no se puede auto-fusionar por nivel 2.
    """
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
    """Extrae el folder id de un ``source_tender_id`` PLACSP ``prefijo:EXP``.

    Si no hay ``:``, no inventamos expediente (p. ej. ids opacos de otras APIs).
    """
    text = source_tender_id.strip()
    if ":" not in text:
        return None
    _, _, rest = text.partition(":")
    rest = rest.strip()
    return rest or None


def title_similarity(a: str | None, b: str | None) -> float:
    """Similitud de título normalizado (0–1). Solo refuerzo; nunca fusión sola.

    Un título muy parecido puede subir a ``pending``, no a ``auto``.
    """
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
    """Adjunta ``payload['match']`` a cada registro de la fuente actual.

    Sin ``lookup`` (p. ej. dry-run sin repo) todo queda ``unmatched``: no hay
    canónico contra el que comparar. Con lookup, cada fila se decide por separado.
    """
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
    """Elige un único outcome (auto / pending / unmatched) para el registro.

    Tras puntuar candidatos: un solo ``auto`` gana; varios ``auto`` o solo
    ``pending`` → no fusionar (ambigüedad o baja confianza).
    """
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
        # Había filas en el prefiltro, pero ninguna pasó umbral de score.
        return _unmatched()

    autos = [s for s in scored if s.review_status == REVIEW_AUTO]
    if len(autos) == 1:
        return _from_scored(autos[0])
    if len(autos) > 1:
        # Dos fuentes "igual de buenas" → no elegimos a ciegas cuál fusionar.
        # pending sin matched_tender_id: el upsert crea fila propia.
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
        # Best informativo para Studio/SQL (ADR 010). reuse_tender_id queda null
        # en el upsert: se crea tender propio y se guarda el candidato aparte.
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
    """Puntúa un candidato. ``None`` = descartar (no aporta ni pending).

    Niveles alineados al roadmap: (2) expediente+NIF, (3) NIF+señales,
    (4) similitud/título solo como pending. El nivel 1 (id intra-fuente) lo
    cubre el unique ``(source_code, source_tender_id)`` del upsert, no este scorer.
    """
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
    # Señales "blandas": CPV, importe ±1 %, misma fecha de pub, título ≥ 0.85.
    signal_hits = sum((cpv_match, amount_match, date_match, sim >= 0.85))

    # Nivel 2 — misma carpeta + mismo NIF/CIF: identidad fuerte → auto.
    if tax_match and exp_match:
        return _ScoredMatch(
            candidate=candidate,
            review_status=REVIEW_AUTO,
            match_method=METHOD_EXPEDIENTE_TAX_ID,
            match_score=1.0,
        )

    # Nivel 3 — mismo NIF + ≥2 señales blandas: suficiente para auto sin expediente.
    # El nombre del organismo no entra: dos ayuntamientos pueden llamarse igual.
    if tax_match and signal_hits >= 2:
        return _ScoredMatch(
            candidate=candidate,
            review_status=REVIEW_AUTO,
            match_method=METHOD_TAX_ID_SIGNALS,
            match_score=min(0.95, 0.75 + 0.05 * signal_hits + 0.1 * sim),
        )

    # A partir de aquí: indicios útiles pero no fiables → pending (revisión humana).
    if exp_match and not tax_match:
        # Mismo expediente en organismos distintos (o sin NIF) es típico de colisión.
        return _ScoredMatch(
            candidate=candidate,
            review_status=REVIEW_PENDING,
            match_method=METHOD_SIGNAL_BUNDLE,
            match_score=0.55,
        )
    if tax_match and signal_hits >= 1:
        # NIF coincide pero solo una señal blanda: no auto-fusionar.
        return _ScoredMatch(
            candidate=candidate,
            review_status=REVIEW_PENDING,
            match_method=METHOD_TAX_ID_SIGNALS,
            match_score=0.6 + 0.05 * signal_hits,
        )
    if signal_hits >= 3 or sim >= 0.92:
        # Muchas señales o título casi idéntico sin NIF (p. ej. Catalunya sin tax_id).
        return _ScoredMatch(
            candidate=candidate,
            review_status=REVIEW_PENDING,
            match_method=METHOD_TITLE_SIMILARITY if sim >= 0.92 else METHOD_SIGNAL_BUNDLE,
            match_score=max(0.5, sim if sim >= 0.92 else 0.5 + 0.05 * signal_hits),
        )
    return None


def _amounts_close(a: Decimal | None, b: Decimal | None) -> bool:
    """True si los importes están a ≤1 % relativo (ruido de redondeo / moneda)."""
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
    """Normaliza fecha canónica (date/datetime/ISO) para comparar publicación."""
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
    """Empaqueta un score ganador; ``matched_tender_id`` es el id a reutilizar en auto."""
    return {
        "review_status": scored.review_status,
        "match_method": scored.match_method,
        "match_score": round(scored.match_score, 4),
        "matched_tender_id": scored.candidate.tender_id,
    }


def _annotate(record: SourceRecord, match: dict[str, Any]) -> SourceRecord:
    """Copia el record con ``payload['match']`` (inmutable vía model_copy)."""
    payload = dict(record.payload or {})
    payload["match"] = match
    return record.model_copy(update={"payload": payload})
