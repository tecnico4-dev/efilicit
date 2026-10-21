import type { SearchCriteria } from "@efilicit/types";
import { SEARCH_CCAA_OPTIONS } from "@/lib/geo-ccaa";
import {
  formatContractType,
  formatProcedureType,
  formatTenderStatus,
} from "@/lib/tender-labels";

/** Interpreta jsonb de alertas / búsquedas como Criteria v1. */
export function parseCriteria(raw: unknown): SearchCriteria {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { version: 1 };
  }
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return { version: 1 };
  return o as SearchCriteria;
}

function ccaaLabel(code: string): string {
  return SEARCH_CCAA_OPTIONS.find((o) => o.code === code)?.name ?? code;
}

/** Resumen legible de criteria v1 (keywords, CPV, importes, geografía). */
export function formatCriteriaSummary(criteria: SearchCriteria): string {
  const parts: string[] = [];

  if (criteria.keywords?.length) {
    parts.push(criteria.keywords.join(", "));
  }
  if (criteria.cpv_codes?.length) {
    const mode =
      criteria.cpv_codes.length >= 2 && criteria.cpv_match === "all"
        ? "todos"
        : criteria.cpv_codes.length >= 2
          ? "cualquiera"
          : null;
    parts.push(
      mode
        ? `CPV (${mode}) ${criteria.cpv_codes.join(", ")}`
        : `CPV ${criteria.cpv_codes.join(", ")}`,
    );
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
  const ccaaCodes = criteria.geography?.ccaa_codes?.filter(Boolean) ?? [];
  if (ccaaCodes.length) {
    parts.push(`CCAA ${ccaaCodes.map(ccaaLabel).join(", ")}`);
  }
  const munCodes =
    criteria.geography?.municipality_codes?.filter(Boolean) ?? [];
  if (munCodes.length) {
    parts.push(`Municipio ${munCodes.join(", ")}`);
  }
  if (criteria.statuses?.length) {
    parts.push(
      `Estado ${criteria.statuses.map(formatTenderStatus).join(", ")}`,
    );
  }
  if (criteria.procedure_types?.length) {
    parts.push(
      `Procedimiento ${criteria.procedure_types.map(formatProcedureType).join(", ")}`,
    );
  }
  if (criteria.contract_types?.length) {
    parts.push(
      `Tipo ${criteria.contract_types.map(formatContractType).join(", ")}`,
    );
  }
  if (criteria.publication_date_from || criteria.publication_date_to) {
    parts.push(
      `Publicación ${criteria.publication_date_from ?? "—"}–${criteria.publication_date_to ?? "—"}`,
    );
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
      criteria.procedure_types?.length ||
      criteria.statuses?.length ||
      criteria.publication_date_from ||
      criteria.publication_date_to,
  );
}

/**
 * Firma estable de criteria (keywords, CPV, importes, geografía) para detectar
 * búsquedas/alertas duplicadas sin depender del orden de arrays.
 */
export function criteriaSignature(criteria: SearchCriteria): string {
  const keywords = criteria.keywords?.length
    ? [...criteria.keywords].map((k) => k.toLowerCase()).sort()
    : undefined;
  const cpv = criteria.cpv_codes?.length
    ? [...criteria.cpv_codes].sort()
    : undefined;
  const ccaa = criteria.geography?.ccaa_codes?.length
    ? [...criteria.geography.ccaa_codes].sort()
    : undefined;
  const municipalities = criteria.geography?.municipality_codes?.length
    ? [...criteria.geography.municipality_codes].sort()
    : undefined;
  return JSON.stringify({
    v: 1,
    keywords: keywords ?? null,
    cpv: cpv ?? null,
    cpv_match:
      cpv && criteria.cpv_match === "all" ? "all" : cpv ? "any" : null,
    min: criteria.estimated_value_min ?? null,
    max: criteria.estimated_value_max ?? null,
    ccaa: ccaa ?? null,
    municipalities: municipalities ?? null,
  });
}

export function criteriaEqual(a: SearchCriteria, b: SearchCriteria): boolean {
  return criteriaSignature(a) === criteriaSignature(b);
}
