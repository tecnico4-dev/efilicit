"""Localizar la zona reciente del listado KontratazioA.

La API pagina ~737k avisos: primero páginas **sin** fecha de publicación
(legado ~2014), luego avisos con ``lastPublicationDate`` / ``firstPublicationDate``
en orden newest-first. La página 1 no es la cabeza de novedades.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from typing import Any

__all__ = [
    "item_has_publication_date",
    "page_has_publication_date",
    "find_first_dated_page",
]

_DATE_KEYS = ("lastPublicationDate", "firstPublicationDate")


def item_has_publication_date(item: Mapping[str, Any]) -> bool:
    """True si el aviso trae alguna fecha de publicación usable."""
    for key in _DATE_KEYS:
        raw = item.get(key)
        if raw is None:
            continue
        if isinstance(raw, str) and raw.strip():
            return True
        if not isinstance(raw, str) and raw:
            return True
    return False


def page_has_publication_date(payload: Mapping[str, Any]) -> bool:
    """True si algún ítem de la página tiene fecha de publicación."""
    items = payload.get("items")
    if not isinstance(items, list):
        return False
    for item in items:
        if isinstance(item, Mapping) and item_has_publication_date(item):
            return True
    return False


def find_first_dated_page(
    *,
    total_pages: int,
    fetch_page: Callable[[int], Mapping[str, Any]],
) -> int:
    """Primera ``currentPage`` (1-based) con al menos un aviso fechado.

    Búsqueda binaria asumiendo: páginas bajas sin fecha, luego un prefijo
    contiguo con fechas (orden real observado en la API).
    """
    if total_pages < 1:
        raise ValueError(f"total_pages must be >= 1, got {total_pages}")

    first = fetch_page(1)
    if page_has_publication_date(first):
        return 1

    last = fetch_page(total_pages)
    if not page_has_publication_date(last):
        # Toda la cola sin fecha: buscar si hay alguna página fechada en medio
        # (no debería ocurrir con el orden actual; fallback lineal barato en tests).
        for page in range(2, total_pages):
            if page_has_publication_date(fetch_page(page)):
                return page
        raise RuntimeError(
            "euskadi recent window: no page with publication dates "
            f"in 1..{total_pages}"
        )

    lo, hi = 1, total_pages
    # Invariante: lo sin fecha (o 1), hi con fecha.
    while lo + 1 < hi:
        mid = (lo + hi) // 2
        if page_has_publication_date(fetch_page(mid)):
            hi = mid
        else:
            lo = mid
    return hi
