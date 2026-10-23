/**
 * Diccionario CPV 2008 (ES) estructurado + normalización a 8 dígitos.
 *
 * Fuente: TED/SIMAP `cpv_2008_ver_2013.xlsx` (columna ES).
 * https://ted.europa.eu/documents/d/ted/cpv_2008_xls
 */
import cpvEs from "@/lib/data/cpv-es.json";

export type CpvNode = {
  label: string;
  check?: string;
  parent: string | null;
  children: string[];
};

type CpvDictionary = {
  meta: {
    vocabulary: string;
    version: string;
    language: string;
    source: string;
    source_url: string;
    generated_at: string;
    code_count: number;
  };
  codes: Record<string, CpvNode>;
};

const DICT = cpvEs as CpvDictionary;
const CPV_CODES = DICT.codes;
/** Códigos ordenados (autocomplete por prefijo). */
const CPV_CODE_LIST = Object.keys(CPV_CODES).sort();

export const CPV_META = DICT.meta;

/** Extrae dígitos y rellena a 8 con ceros a la derecha (ignora dígito de control). */
export function normalizeCpvCode(raw: string): string | null {
  const text = raw.trim().replace(/\s/g, "");
  if (!text) return null;
  const base = text.includes("-") ? text.slice(0, text.indexOf("-")) : text;
  const digits = base.replace(/\D/g, "");
  if (!digits) return null;
  return digits.slice(0, 8).padEnd(8, "0");
}

/** Prefijo significativo para `LIKE code%` (quita ceros finales del código de 8). */
export function cpvSearchPrefix(code: string): string {
  const normalized = normalizeCpvCode(code);
  if (!normalized) return code.replace(/\D/g, "");
  const trimmed = normalized.replace(/0+$/, "");
  return trimmed.length >= 2 ? trimmed : normalized.slice(0, 2);
}

export function cpvCodesForSearch(
  codes: string[] | undefined,
): string[] | undefined {
  if (!codes?.length) return undefined;
  const out = codes
    .map((c) => cpvSearchPrefix(c))
    .filter((c) => c.length > 0);
  return out.length ? out : undefined;
}

export function getCpvNode(code8: string): CpvNode | null {
  return CPV_CODES[code8] ?? null;
}

export function lookupCpvLabel(code8: string): string | null {
  return CPV_CODES[code8]?.label ?? null;
}

/** Raíces del árbol (divisiones, sin padre). */
export function listCpvRoots(): string[] {
  return Object.keys(CPV_CODES)
    .filter((code) => CPV_CODES[code].parent == null)
    .sort();
}

export function listCpvChildren(code8: string): string[] {
  return CPV_CODES[code8]?.children ?? [];
}

/** Formato PLACSP: `33600000-Productos farmacéuticos`. */
export function formatCpvSelection(code8: string): string {
  const label = lookupCpvLabel(code8);
  return label ? `${code8}-${label}` : code8;
}

/**
 * Resumen de CPV en listas: como máximo 2 códigos; si hay más, «…».
 * Ej. `72000000, 72600000…`
 */
export function formatCpvListPreview(
  codes: string[] | null | undefined,
  maxVisible = 2,
): string {
  if (!codes?.length) return "—";
  if (codes.length <= maxVisible) return codes.join(", ");
  return `${codes.slice(0, maxVisible).join(", ")}…`;
}

export function resolveCpvFromInput(raw: string): {
  code: string;
  display: string;
  known: boolean;
  /** Había letras/símbolos/espacios en la base (antes del `-` de control). */
  omittedNonDigits: boolean;
} | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Dígito de control oficial `XXXXXXXX-Y`: no cuenta como “basura” a omitir.
  const base = trimmed.includes("-")
    ? trimmed.slice(0, trimmed.indexOf("-"))
    : trimmed;
  const omittedNonDigits = /\D/.test(base);
  const digits = base.replace(/\D/g, "");
  if (!digits) return null;
  const code = digits.slice(0, 8).padEnd(8, "0");
  const label = lookupCpvLabel(code);
  return {
    code,
    display: label ? `${code}-${label}` : code,
    known: label != null,
    omittedNonDigits,
  };
}

/** Longitud del prefijo significativo (sin ceros finales; mín. 2). */
function cpvSignificantLength(code8: string): number {
  const trimmed = code8.replace(/0+$/, "");
  return Math.max(trimmed.length, 2);
}

export type CpvSuggestion = { code: string; label: string };

/**
 * Sugerencias CPV por prefijo numérico (typeahead).
 * Primero categorías más amplias (menos dígitos significativos), luego código.
 */
export function suggestCpvByPrefix(
  raw: string,
  options?: { limit?: number; exclude?: readonly string[] },
): CpvSuggestion[] {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (!digits) return [];
  const limit = options?.limit ?? 10;
  const exclude = options?.exclude?.length
    ? new Set(options.exclude)
    : null;

  const hits: CpvSuggestion[] = [];
  for (const code of CPV_CODE_LIST) {
    if (!code.startsWith(digits)) continue;
    if (exclude?.has(code)) continue;
    const label = CPV_CODES[code]?.label;
    if (!label) continue;
    hits.push({ code, label });
  }

  hits.sort((a, b) => {
    const la = cpvSignificantLength(a.code);
    const lb = cpvSignificantLength(b.code);
    if (la !== lb) return la - lb;
    return a.code.localeCompare(b.code);
  });

  return hits.slice(0, limit);
}
