/**
 * Tokenización de texto libre para búsqueda / alertas / búsquedas guardadas.
 * Quita stopwords; el motor exige TODAS las palabras significativas (AND).
 * Alineado con `ingestion/.../alerts/keywords.py`. Ver queries/README + CHANGELOG.
 */

const STOPWORDS = new Set([
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
]);

/** Minúsculas sin tildes (alineado con Python `alerts/keywords.py`). */
function fold(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/** Partículas y basura tipográfica → tokens significativos en minúsculas. */
export function tokenizeKeywords(raw: string): string[] {
  const parts = fold(raw)
    .split(/[^a-z0-9]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    if (STOPWORDS.has(p)) continue;
    if (p.length < 2) continue;
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

/** Query limpia para la RPC (stopwords fuera). Vacío si no queda nada útil. */
export function normalizeSearchQuery(raw: string): string {
  return tokenizeKeywords(raw).join(" ");
}
