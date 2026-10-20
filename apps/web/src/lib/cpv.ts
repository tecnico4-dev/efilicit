/**
 * Diccionario CPV 2008 (ES) + normalización a 8 dígitos (ceros a la derecha).
 * Fuente: vocabulario oficial DOUE; lookup para el buscador estilo PLACSP.
 */
import cpvEs from "@/lib/data/cpv-es.json";

const CPV_LABELS = cpvEs as Record<string, string>;

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

export function lookupCpvLabel(code8: string): string | null {
  const label = CPV_LABELS[code8];
  return label ?? null;
}

/** Formato PLACSP: `33600000-Productos farmacéuticos`. */
export function formatCpvSelection(code8: string): string {
  const label = lookupCpvLabel(code8);
  return label ? `${code8}-${label}` : code8;
}

export function resolveCpvFromInput(raw: string): {
  code: string;
  display: string;
  known: boolean;
} | null {
  const code = normalizeCpvCode(raw);
  if (!code) return null;
  const label = lookupCpvLabel(code);
  return {
    code,
    display: label ? `${code}-${label}` : code,
    known: label != null,
  };
}
