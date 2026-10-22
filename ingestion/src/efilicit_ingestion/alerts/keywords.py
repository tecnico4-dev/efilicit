"""Tokenización de keywords alineada con la web (`apps/web/src/lib/keywords.ts`)."""

from __future__ import annotations

import re
import unicodedata

_STOPWORDS = frozenset(
    {
        "a",
        "al",
        "con",
        "de",
        "del",
        "e",
        "el",
        "en",
        "la",
        "las",
        "lo",
        "los",
        "o",
        "para",
        "por",
        "se",
        "sin",
        "su",
        "sus",
        "un",
        "una",
        "unas",
        "unos",
        "y",
    }
)

_SPLIT_RE = re.compile(r"[^a-z0-9áéíóúüñ]+", re.IGNORECASE)


def fold_text(value: str) -> str:
    """Minúsculas sin tildes (comparación de keywords)."""
    decomposed = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch)).lower()


def tokenize_keywords(*raw_parts: str) -> list[str]:
    """Extrae tokens significativos (sin stopwords); orden estable, sin duplicados."""
    out: list[str] = []
    seen: set[str] = set()
    for raw in raw_parts:
        if not raw or not str(raw).strip():
            continue
        for part in _SPLIT_RE.split(str(raw).strip()):
            token = fold_text(part).strip()
            if not token or token in _STOPWORDS or len(token) < 2:
                continue
            if token in seen:
                continue
            seen.add(token)
            out.append(token)
    return out
