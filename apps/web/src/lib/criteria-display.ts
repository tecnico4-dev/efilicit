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
    parts.push(`importe sin IVA ${min}–${max}`);
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
  if (criteria.open_for_submission === true) {
    parts.push("Solo en plazo");
  }

  return parts.length ? parts.join(" · ") : "Sin criterios";
}

/** Valores iniciales del bloque compartido de filtros (búsqueda / alertas). */
export type CriteriaFilterInitial = {
  q: string;
  cpvCodes: string[];
  cpvMatch: "any" | "all";
  min: string;
  max: string;
  ccaa: string;
  municipalityCode: string;
  municipalityName: string;
  status: string;
  procedure: string;
  contractType: string;
  pubFrom: string;
  pubTo: string;
  openForSubmission: boolean;
};

export function emptyCriteriaFilterInitial(): CriteriaFilterInitial {
  return {
    q: "",
    cpvCodes: [],
    cpvMatch: "any",
    min: "",
    max: "",
    ccaa: "",
    municipalityCode: "",
    municipalityName: "",
    status: "",
    procedure: "",
    contractType: "",
    pubFrom: "",
    pubTo: "",
    openForSubmission: false,
  };
}

/** Hidrata el formulario compartido desde Criteria v1. */
export function criteriaToFilterInitial(
  criteria: SearchCriteria,
): CriteriaFilterInitial {
  const base = emptyCriteriaFilterInitial();
  return {
    ...base,
    q: criteria.keywords?.join(" ") ?? "",
    cpvCodes: criteria.cpv_codes?.length ? [...criteria.cpv_codes] : [],
    cpvMatch:
      criteria.cpv_codes &&
      criteria.cpv_codes.length >= 2 &&
      criteria.cpv_match === "all"
        ? "all"
        : "any",
    min:
      criteria.estimated_value_min != null
        ? String(criteria.estimated_value_min)
        : "",
    max:
      criteria.estimated_value_max != null
        ? String(criteria.estimated_value_max)
        : "",
    ccaa: criteria.geography?.ccaa_codes?.[0] ?? "",
    municipalityCode: criteria.geography?.municipality_codes?.[0] ?? "",
    municipalityName: "",
    status: criteria.statuses?.[0] ?? "",
    procedure: criteria.procedure_types?.[0] ?? "",
    contractType: criteria.contract_types?.[0] ?? "",
    pubFrom: criteria.publication_date_from ?? "",
    pubTo: criteria.publication_date_to ?? "",
    openForSubmission: criteria.open_for_submission === true,
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
      criteria.publication_date_to ||
      criteria.open_for_submission === true,
  );
}

/**
 * Firma estable de criteria v1 para detectar búsquedas/alertas duplicadas
 * sin depender del orden de arrays. Incluye las dimensiones del buscador MVP.
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
  const statuses = criteria.statuses?.length
    ? [...criteria.statuses].sort()
    : undefined;
  const procedureTypes = criteria.procedure_types?.length
    ? [...criteria.procedure_types].sort()
    : undefined;
  const contractTypes = criteria.contract_types?.length
    ? [...criteria.contract_types].sort()
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
    statuses: statuses ?? null,
    procedure_types: procedureTypes ?? null,
    contract_types: contractTypes ?? null,
    publication_date_from: criteria.publication_date_from ?? null,
    publication_date_to: criteria.publication_date_to ?? null,
    open_for_submission: criteria.open_for_submission === true ? true : null,
  });
}

export function criteriaEqual(a: SearchCriteria, b: SearchCriteria): boolean {
  return criteriaSignature(a) === criteriaSignature(b);
}
