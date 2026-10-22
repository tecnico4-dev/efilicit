"""Evaluador de alertas: Criteria v1 → match / score / priority (Paso 7.1).

No consulta la base de datos: opera sobre ``TenderCandidate`` ya proyectados.
La semántica de producto debe alinearse con la RPC ``search_tenders`` (filtros)
aunque el ranking de búsqueda (FTS/trgm) no se reutiliza aquí.

Reglas:

- Dimensiones omitidas = no entran en el AND.
- Dentro de una dimensión lista (keywords, CPV, …): OR.
- Criteria vacío (solo ``version``) → sin match (anti-spam).
- Score = dimensiones que pasan / dimensiones activas; prioridad por umbrales.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from efilicit_ingestion.alerts.criteria import SearchCriteria, parse_criteria
from efilicit_ingestion.alerts.models import AlertMatch, AlertRule, TenderCandidate

PRIORITY_HIGH = "high"
PRIORITY_MEDIUM = "medium"
PRIORITY_LOW = "low"


def _norm(text: str | None) -> str:
    """Normaliza texto para comparaciones case-insensitive (keywords / nombre)."""
    return (text or "").casefold().strip()


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    return date.fromisoformat(value[:10])


def _parse_dt(value: str | None) -> datetime | None:
    """ISO → UTC (naive / solo fecha = Europe/Madrid, igual que canónico)."""
    from efilicit_ingestion.pipeline.canonical import parse_datetime_to_utc

    return parse_datetime_to_utc(value)


def _text_blob(tender: TenderCandidate) -> str:
    """Título + descripción: corpus para keywords (substring, no FTS)."""
    return f"{tender.title}\n{tender.description or ''}"


def _keyword_hit(tender: TenderCandidate, keywords: list[str]) -> bool:
    blob = _norm(_text_blob(tender))
    return any(_norm(k) in blob for k in keywords if k.strip())


def _cpv_hit(
    tender: TenderCandidate,
    codes: list[str],
    *,
    match: str | None = None,
) -> bool:
    """Prefijo CPV: ``any`` (OR×OR, default) o ``all`` (cada criterio cubierto)."""
    tender_codes = [c.strip() for c in tender.cpv_codes if c and str(c).strip()]
    if not tender_codes:
        return False
    needles = [code.strip() for code in codes if code.strip()]
    if not needles:
        return False
    mode = (match or "any").strip().lower()
    if mode == "all":
        return all(
            any(tc.startswith(needle) for tc in tender_codes) for needle in needles
        )
    return any(tc.startswith(needle) for tc in tender_codes for needle in needles)


def _authority_hit(tender: TenderCandidate, criteria: SearchCriteria) -> bool | None:
    """None = dimensión no pedida; bool = OR entre señales configuradas."""
    auth = criteria.authority
    if auth is None:
        return None
    checks: list[bool] = []
    if auth.tax_ids:
        tax = (tender.authority_tax_id or "").strip()
        checks.append(bool(tax) and tax in auth.tax_ids)
    if auth.ids:
        aid = (tender.authority_id or "").strip()
        checks.append(bool(aid) and aid in auth.ids)
    if auth.name_contains:
        needle = _norm(auth.name_contains)
        hay = _norm(tender.authority_name_normalized) or _norm(tender.authority_name)
        checks.append(bool(needle) and needle in hay)
    if not checks:
        return None
    # Dentro de authority: basta una señal (OR); NIF/CIF es la más fiable.
    return any(checks)


def _geography_hit(tender: TenderCandidate, criteria: SearchCriteria) -> bool | None:
    """Lugar de ejecución (códigos) + legacy sede organismo / país."""
    geo = criteria.geography
    if geo is None:
        return None
    checks: list[bool] = []
    if geo.ccaa_codes:
        code = (tender.place_ccaa_code or "").strip()
        checks.append(bool(code) and code in geo.ccaa_codes)
    if geo.municipality_codes:
        code = (tender.place_municipality_code or "").strip()
        checks.append(bool(code) and code in geo.municipality_codes)
    if geo.municipalities:
        mun = _norm(tender.municipality)
        checks.append(bool(mun) and mun in {_norm(m) for m in geo.municipalities})
    if geo.countries:
        country = (tender.country or "").strip()
        checks.append(bool(country) and country in geo.countries)
    if not checks:
        return None
    return any(checks)


def _value_in_range(tender: TenderCandidate, criteria: SearchCriteria) -> bool | None:
    if criteria.estimated_value_min is None and criteria.estimated_value_max is None:
        return None
    if tender.estimated_value is None:
        return False
    value = Decimal(str(tender.estimated_value))
    if criteria.estimated_value_min is not None and value < Decimal(
        str(criteria.estimated_value_min)
    ):
        return False
    if criteria.estimated_value_max is not None and value > Decimal(
        str(criteria.estimated_value_max)
    ):
        return False
    return True


def _list_field_hit(actual: str | None, wanted: list[str] | None) -> bool | None:
    if not wanted:
        return None
    if not actual:
        return False
    return actual in wanted


def _date_from_hit(tender: TenderCandidate, criteria: SearchCriteria) -> bool | None:
    if criteria.publication_date_from is None and criteria.publication_date_to is None:
        return None
    if tender.publication_date is None:
        return False
    lo = _parse_date(criteria.publication_date_from)
    hi = _parse_date(criteria.publication_date_to)
    if lo is not None and tender.publication_date < lo:
        return False
    if hi is not None and tender.publication_date > hi:
        return False
    return True


def _deadline_hit(tender: TenderCandidate, criteria: SearchCriteria) -> bool | None:
    if criteria.open_for_submission is True:
        if tender.deadline_at is None:
            return False
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc)
        deadline = tender.deadline_at
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)
        return deadline > now

    if criteria.deadline_from is None and criteria.deadline_to is None:
        return None
    if tender.deadline_at is None:
        return False
    lo = _parse_dt(criteria.deadline_from)
    hi = _parse_dt(criteria.deadline_to)
    t = tender.deadline_at
    if lo is not None and t < lo:
        return False
    if hi is not None and t > hi:
        return False
    return True


def score_to_priority(score: float) -> str:
    """Umbrales fijos del MVP (no configurables por usuario)."""
    if score >= 0.75:
        return PRIORITY_HIGH
    if score >= 0.45:
        return PRIORITY_MEDIUM
    return PRIORITY_LOW


def evaluate_tender(
    criteria: SearchCriteria,
    tender: TenderCandidate,
) -> AlertMatch | None:
    """Devuelve match si todas las dimensiones presentes pasan (AND); None si no.

    Arrays dentro de una dimensión: OR. Criteria vacío → no match (anti-spam).
    ``alert_id`` / ``user_id`` los rellena el caller (aquí van vacíos).
    """
    if not criteria.has_filters():
        return None

    dimensions: list[tuple[str, bool | None]] = [
        (
            "keywords",
            _keyword_hit(tender, criteria.keywords) if criteria.keywords else None,
        ),
        (
            "cpv_codes",
            (
                _cpv_hit(tender, criteria.cpv_codes, match=criteria.cpv_match)
                if criteria.cpv_codes
                else None
            ),
        ),
        ("authority", _authority_hit(tender, criteria)),
        ("geography", _geography_hit(tender, criteria)),
        ("estimated_value", _value_in_range(tender, criteria)),
        (
            "contract_types",
            _list_field_hit(tender.contract_type, criteria.contract_types),
        ),
        (
            "procedure_types",
            _list_field_hit(tender.procedure_type, criteria.procedure_types),
        ),
        ("statuses", _list_field_hit(tender.status, criteria.statuses)),
        ("publication_date", _date_from_hit(tender, criteria)),
        ("deadline", _deadline_hit(tender, criteria)),
    ]

    active = [(name, ok) for name, ok in dimensions if ok is not None]
    if not active:
        return None
    if any(ok is False for _, ok in active):
        return None

    reasons = tuple(name for name, ok in active if ok)
    score = len(reasons) / len(active)
    return AlertMatch(
        alert_id="",
        user_id="",
        tender_id=tender.id,
        score=score,
        priority=score_to_priority(score),
        reasons=reasons,
    )


def match_alert_to_tenders(
    alert: AlertRule,
    tenders: list[TenderCandidate],
) -> list[AlertMatch]:
    """Evalúa una regla contra una lista de candidatos; respeta ``is_active``."""
    if not alert.is_active:
        return []
    criteria = parse_criteria(alert.criteria)
    if not criteria.has_filters():
        return []

    out: list[AlertMatch] = []
    for tender in tenders:
        hit = evaluate_tender(criteria, tender)
        if hit is None:
            continue
        out.append(
            AlertMatch(
                alert_id=alert.id,
                user_id=alert.user_id,
                tender_id=hit.tender_id,
                score=hit.score,
                priority=hit.priority,
                reasons=hit.reasons,
            )
        )
    return out
