import type { SearchCriteria } from "@efilicit/types";

/** Interpreta jsonb de alertas / búsquedas como Criteria v1. */
export function parseCriteria(raw: unknown): SearchCriteria {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { version: 1 };
  }
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return { version: 1 };
  return o as SearchCriteria;
}

/** Resumen legible de criteria v1 (MVP: keywords, CPV, importes). */
export function formatCriteriaSummary(criteria: SearchCriteria): string {
  const parts: string[] = [];

  if (criteria.keywords?.length) {
    parts.push(criteria.keywords.join(", "));
  }
  if (criteria.cpv_codes?.length) {
    parts.push(`CPV ${criteria.cpv_codes.join(", ")}`);
  }
  if (
    criteria.estimated_value_min != null ||
    criteria.estimated_value_max != null
  ) {
    const min =
      criteria.estimated_value_min != null
        ? String(criteria.estimated_value_min)
        : "—";
    const max =
      criteria.estimated_value_max != null
        ? String(criteria.estimated_value_max)
        : "—";
    parts.push(`importe ${min}–${max}`);
  }

  return parts.length ? parts.join(" · ") : "Sin criterios";
}

/** Campos editables del formulario de alertas (subset MVP de criteria v1). */
export function criteriaToFormFields(criteria: SearchCriteria): {
  keywords: string;
  cpv: string;
  min: string;
  max: string;
} {
  return {
    keywords: criteria.keywords?.join(", ") ?? "",
    cpv: criteria.cpv_codes?.[0] ?? "",
    min:
      criteria.estimated_value_min != null
        ? String(criteria.estimated_value_min)
        : "",
    max:
      criteria.estimated_value_max != null
        ? String(criteria.estimated_value_max)
        : "",
  };
}

export function formFieldsToCriteria(input: {
  keywords: string;
  cpv: string;
  min?: string;
  max?: string;
}): SearchCriteria {
  const kw = input.keywords
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const cpv = input.cpv.trim();
  const minRaw = input.min?.trim() ?? "";
  const maxRaw = input.max?.trim() ?? "";
  const min = minRaw === "" ? undefined : Number(minRaw);
  const max = maxRaw === "" ? undefined : Number(maxRaw);
  return {
    version: 1,
    keywords: kw.length ? kw : undefined,
    cpv_codes: cpv ? [cpv] : undefined,
    estimated_value_min: min != null && !Number.isNaN(min) ? min : undefined,
    estimated_value_max: max != null && !Number.isNaN(max) ? max : undefined,
  };
}

export function criteriaHasFilters(criteria: SearchCriteria): boolean {
  return Boolean(
    criteria.keywords?.length ||
      criteria.cpv_codes?.length ||
      criteria.estimated_value_min != null ||
      criteria.estimated_value_max != null ||
      criteria.authority ||
      criteria.geography ||
      criteria.contract_types?.length ||
      criteria.statuses?.length,
  );
}
