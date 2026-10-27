/**
 * Diccionario CPV 2008 (ES) — import síncrono del JSON (~9k códigos).
 * Para la UI de búsqueda preferir `preloadCpvDictionary` / `cpv-load.ts`
 * para no bloquear el bundle inicial de `/search`.
 */
import cpvEs from "@/lib/data/cpv-es.json";
import { normalizeCpvCode } from "@/lib/cpv";

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
const CPV_CODE_LIST = Object.keys(CPV_CODES).sort();

export const CPV_META = DICT.meta;

export function getCpvNode(code8: string): CpvNode | null {
  return CPV_CODES[code8] ?? null;
}

export function lookupCpvLabel(code8: string): string | null {
  return CPV_CODES[code8]?.label ?? null;
}

export function listCpvRoots(): string[] {
  return Object.keys(CPV_CODES)
    .filter((code) => CPV_CODES[code].parent == null)
    .sort();
}

export function listCpvChildren(code8: string): string[] {
  return CPV_CODES[code8]?.children ?? [];
}

export function formatCpvSelection(code8: string): string {
  const label = lookupCpvLabel(code8);
  return label ? `${code8}-${label}` : code8;
}

export function resolveCpvFromInput(raw: string): {
  code: string;
  display: string;
  known: boolean;
  omittedNonDigits: boolean;
} | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
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

function cpvSignificantLength(code8: string): number {
  const trimmed = code8.replace(/0+$/, "");
  return Math.max(trimmed.length, 2);
}

export type CpvSuggestion = { code: string; label: string };

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

/** Re-export for callers that only need normalize alongside dict helpers. */
export { normalizeCpvCode };
