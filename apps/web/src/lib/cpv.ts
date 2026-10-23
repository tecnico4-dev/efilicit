/**
 * Utilidades CPV ligeras (sin JSON del diccionario).
 * Etiquetas / árbol / typeahead: `@/lib/cpv-dictionary` o `preloadCpvDictionary`.
 */

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
