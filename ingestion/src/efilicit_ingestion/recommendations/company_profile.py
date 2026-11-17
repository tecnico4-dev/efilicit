"""Perfil empresa Eficen: CPV y keywords para boost (doc «quién es Eficen»).

Solo refuerzo / puerta de entrada — no filtro duro. Códigos `[validar]` del doc
se omiten hasta confirmación de dirección.
"""

from __future__ import annotations

import re
from decimal import Decimal

# CPV prioridad alta (directo + digital), sin los marcados [validar] en el doc.
EFICEN_HIGH_CPV_PREFIXES: tuple[str, ...] = (
    "71314000",
    "71314200",
    "71314300",
    "71240000",
    "71320000",
    "71321000",
    "71520000",
    "48000000",
    "72260000",
)

# CPV media: obra/mantenimiento alumbrado → sobre todo subcontrata / vía socio.
EFICEN_MEDIUM_CPV_PREFIXES: tuple[str, ...] = (
    "45316100",
    "50232100",
    "51112200",
)

POSITIVE_KEYWORDS: tuple[str, ...] = (
    "alumbrado público",
    "alumbrado exterior",
    "renovación led",
    "eficiencia energética",
    "contaminación lumínica",
    "plan director de alumbrado",
    "auditoría energética",
    "mapa lumínico",
    "inventario de alumbrado",
    "dirección de obra",
    "dirección facultativa",
    "asistencia técnica",
    "telegestión",
    "telecontrol",
    "telemedida",
    "cuadros de mando",
    "plataforma de gestión",
    "gestión energética",
    "smart city",
    "ciudad inteligente",
    "gemelo digital",
    "fotovoltaica",
    "autoconsumo",
    "dus 5000",
    "pree",
    "next generation",
    "prtr",
    "feder",
)

NEGATIVE_KEYWORDS: tuple[str, ...] = (
    "alumbrado navideño",
    "iluminación festiva",
    "ornamental",
    "suministro de energía eléctrica",
    "limpieza viaria",
)

# Banda suave de importe para encaje directo (propia), €.
DIRECT_AMOUNT_MAX = Decimal("200000")


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", text.casefold().strip())


def cpv_company_fit(cpv_codes: tuple[str, ...] | list[str], *, profile: str) -> float:
    """0..1 según mejor prefijo CPV del perfil empresa."""
    best = 0.0
    codes = [c for c in cpv_codes if c]
    for code in codes:
        digits = re.sub(r"\D", "", code)
        if not digits:
            continue
        for pref in EFICEN_HIGH_CPV_PREFIXES:
            if digits.startswith(pref[:3]):
                # Escala por longitud de prefijo coincidente
                n = 0
                for a, b in zip(digits, pref, strict=False):
                    if a != b:
                        break
                    n += 1
                score = {8: 1.0, 7: 0.95, 6: 0.85, 5: 0.75, 4: 0.55, 3: 0.35}.get(
                    n, 0.2 if n >= 3 else 0.0
                )
                # En subcontrata, CPV altos de ingeniería pesan menos que media obra
                if profile == "subcontrata":
                    score *= 0.55
                best = max(best, score)
        for pref in EFICEN_MEDIUM_CPV_PREFIXES:
            if digits.startswith(pref[:3]):
                n = sum(1 for a, b in zip(digits, pref, strict=False) if a == b)
                # Para subcontrata, obra/mantenimiento es señal fuerte
                base = {8: 1.0, 7: 0.9, 6: 0.8, 5: 0.7, 4: 0.5, 3: 0.3}.get(
                    n, 0.0
                )
                if profile == "propia":
                    base *= 0.45  # vía socio / venta producto
                best = max(best, base)
    return min(1.0, best)


def keyword_company_fit(title: str, description: str = "") -> tuple[float, float]:
    """Devuelve (positivo 0..1, negativo 0..1) por keywords del perfil."""
    blob = _norm(f"{title} {description}")
    if not blob:
        return 0.0, 0.0
    pos_hits = sum(1 for k in POSITIVE_KEYWORDS if k in blob)
    neg_hits = sum(1 for k in NEGATIVE_KEYWORDS if k in blob)
    pos = min(1.0, pos_hits * 0.25)
    neg = min(1.0, neg_hits * 0.5)
    return pos, neg


def amount_company_fit(
    value: Decimal | None, *, profile: str
) -> float:
    """1 si encaja en banda directa; baja si es muy alto (propia)."""
    if value is None:
        return 0.5
    if profile == "subcontrata":
        # Importes altos de obra pueden ser oportunidad vía socio
        if value <= DIRECT_AMOUNT_MAX:
            return 0.7
        return 0.9
    if value <= DIRECT_AMOUNT_MAX:
        return 1.0
    # Muy por encima: posible UTE/socio, no descarte
    return 0.35


def company_fit_score(
    *,
    profile: str,
    cpv_codes: tuple[str, ...] | list[str],
    title: str,
    description: str = "",
    estimated_value: Decimal | None = None,
) -> tuple[float, dict[str, float]]:
    """Score compuesto 0..1 del encaje con el perfil empresa + desglose."""
    cpv = cpv_company_fit(cpv_codes, profile=profile)
    pos_kw, neg_kw = keyword_company_fit(title, description)
    amount = amount_company_fit(estimated_value, profile=profile)
    raw = 0.50 * cpv + 0.35 * pos_kw + 0.15 * amount - 0.40 * neg_kw
    score = max(0.0, min(1.0, raw))
    return score, {
        "cpv": round(cpv, 4),
        "keywords": round(pos_kw, 4),
        "amount": round(amount, 4),
        "neg_keywords": round(neg_kw, 4),
    }
