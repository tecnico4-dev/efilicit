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

/** `YYYY-MM-DD` → `DD/MM/YYYY`. */
function formatDateEs(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return iso.trim();
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function formatImportePart(criteria: SearchCriteria): string | null {
  const min = criteria.estimated_value_min;
  const max = criteria.estimated_value_max;
  if (min == null && max == null) return null;
  if (min != null && max != null) return `Importe: [${min}-${max}]€`;
  if (max != null) return `Importe<${max}€`;
  return `Importe>${min!}€`;
}

function formatFechaPart(criteria: SearchCriteria): string | null {
  const from = criteria.publication_date_from?.trim() || "";
  const to = criteria.publication_date_to?.trim() || "";
  if (!from && !to) return null;
  const left = from ? formatDateEs(from) : "...";
  const right = to ? formatDateEs(to) : "...";
  return `Fecha: [${left}-${right}]`;
}

export type FormatCriteriaSummaryOptions = {
  /** Nombres de municipio por código INE (sin esto no se muestra el municipio). */
  municipalityNames?: Readonly<Record<string, string>>;
};

/**
 * Resumen legible de criteria v1 para chips / listados.
 * Formato: `Campo: valor(es)` separados por ` ~ `.
 */
export function formatCriteriaSummary(
  criteria: SearchCriteria,
  options?: FormatCriteriaSummaryOptions,
): string {
  const parts: string[] = [];
  const munNames = options?.municipalityNames ?? {};

  if (criteria.keywords?.length) {
    const words = criteria.keywords;
    const shown = words.slice(0, 3).join(" ");
    const text = words.length > 3 ? `${shown}…` : shown;
    parts.push(`Texto: "${text}"`);
  }
  if (criteria.cpv_codes?.length) {
    const mode =
      criteria.cpv_codes.length >= 2 && criteria.cpv_match === "all"
        ? "todos"
        : criteria.cpv_codes.length >= 2
          ? "cualquiera"
          : null;
    const codes = criteria.cpv_codes;
    const shown = codes.slice(0, 2).join(", ");
    const codesStr = codes.length > 2 ? `${shown}…` : shown;
    parts.push(mode ? `CPV (${mode}): ${codesStr}` : `CPV: ${codesStr}`);
  }

  const ccaaCodes = criteria.geography?.ccaa_codes?.filter(Boolean) ?? [];
  const munCodes =
    criteria.geography?.municipality_codes?.filter(Boolean) ?? [];
  const munLabels = munCodes
    .map((code) => munNames[code]?.trim())
    .filter((n): n is string => Boolean(n));
  if (ccaaCodes.length || munLabels.length) {
    const placeBits = [
      ...ccaaCodes.map(ccaaLabel),
      ...munLabels,
    ];
    parts.push(`Lugar: ${placeBits.join(", ")}`);
  }

  if (criteria.statuses?.length) {
    parts.push(
      `Estado: ${criteria.statuses.map(formatTenderStatus).join(", ")}`,
    );
  }
  if (criteria.procedure_types?.length) {
    parts.push(
      `Procedimiento: ${criteria.procedure_types.map(formatProcedureType).join(", ")}`,
    );
  }
  if (criteria.contract_types?.length) {
    parts.push(
      `Tipo: ${criteria.contract_types.map(formatContractType).join(", ")}`,
    );
  }

  const importe = formatImportePart(criteria);
  if (importe) parts.push(importe);

  const fecha = formatFechaPart(criteria);
  if (fecha) parts.push(fecha);

  if (criteria.open_for_submission === true) {
    parts.push("Solo en plazo: sí");
  }

  return parts.length ? parts.join(" ~ ") : "Sin criterios";
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
