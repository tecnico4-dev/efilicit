import type { SearchCriteria } from "@efilicit/types";
import { normalizeSearchQuery, tokenizeKeywords } from "@/lib/keywords";

type TenderSlice = {
  title: string;
  status: string | null;
  procedure_type?: string | null;
  contract_type?: string | null;
  estimated_value: number | null;
  cpv_codes: string[];
  publication_date: string | null;
  deadline_at: string | null;
} | null;

/** Nº de criterios activos (cada bloque cuenta como 1). */
export function countActiveFavoriteFilters(
  criteria: SearchCriteria | null,
): number {
  if (!criteria) return 0;
  let n = 0;
  if (criteria.keywords?.length) n += 1;
  if (criteria.cpv_codes?.length) n += 1;
  if (criteria.estimated_value_min != null) n += 1;
  if (criteria.estimated_value_max != null) n += 1;
  if (criteria.statuses?.length) n += 1;
  if (criteria.procedure_types?.length) n += 1;
  if (criteria.contract_types?.length) n += 1;
  if (criteria.publication_date_from) n += 1;
  if (criteria.publication_date_to) n += 1;
  if (criteria.geography?.ccaa_codes?.length) n += 1;
  if (criteria.geography?.municipality_codes?.length) n += 1;
  if (criteria.open_for_submission) n += 1;
  return n;
}

function textMatches(haystack: string, keywords: string[]): boolean {
  const norm = normalizeSearchQuery(haystack).toLowerCase();
  if (!norm) return false;
  return keywords.every((kw) => norm.includes(kw.toLowerCase()));
}

function cpvMatches(
  codes: string[],
  wanted: string[],
  match: "any" | "all" | undefined,
): boolean {
  if (wanted.length === 0) return true;
  const set = new Set(codes.map((c) => c.trim()).filter(Boolean));
  if (match === "all") {
    return wanted.every((w) =>
      [...set].some((c) => c === w || c.startsWith(w) || w.startsWith(c)),
    );
  }
  return wanted.some((w) =>
    [...set].some((c) => c === w || c.startsWith(w) || w.startsWith(c)),
  );
}

/** Filtra por Criteria v1 sobre el tender embebido (geo no disponible → se ignora). */
export function tenderMatchesFavoriteFilters(
  tender: TenderSlice,
  criteria: SearchCriteria | null,
): boolean {
  if (!criteria) return true;
  if (!tender) return false;

  if (criteria.keywords?.length) {
    const tokens = tokenizeKeywords(criteria.keywords.join(" "));
    if (tokens.length && !textMatches(tender.title, tokens)) return false;
  }

  if (criteria.cpv_codes?.length) {
    if (
      !cpvMatches(
        tender.cpv_codes ?? [],
        criteria.cpv_codes,
        criteria.cpv_match,
      )
    ) {
      return false;
    }
  }

  if (criteria.estimated_value_min != null) {
    if (
      tender.estimated_value == null ||
      tender.estimated_value < criteria.estimated_value_min
    ) {
      return false;
    }
  }
  if (criteria.estimated_value_max != null) {
    if (
      tender.estimated_value == null ||
      tender.estimated_value > criteria.estimated_value_max
    ) {
      return false;
    }
  }

  if (criteria.statuses?.length) {
    if (!tender.status || !criteria.statuses.includes(tender.status)) {
      return false;
    }
  }
  if (criteria.procedure_types?.length) {
    if (
      !tender.procedure_type ||
      !criteria.procedure_types.includes(tender.procedure_type)
    ) {
      return false;
    }
  }
  if (criteria.contract_types?.length) {
    if (
      !tender.contract_type ||
      !criteria.contract_types.includes(tender.contract_type)
    ) {
      return false;
    }
  }

  if (criteria.publication_date_from) {
    if (
      !tender.publication_date ||
      tender.publication_date < criteria.publication_date_from
    ) {
      return false;
    }
  }
  if (criteria.publication_date_to) {
    if (
      !tender.publication_date ||
      tender.publication_date > criteria.publication_date_to
    ) {
      return false;
    }
  }

  if (criteria.open_for_submission) {
    if (!tender.deadline_at) return false;
    if (new Date(tender.deadline_at).getTime() <= Date.now()) return false;
  }

  // CCAA / municipio: no van en el listado de favoritos (sin dato canónico aquí).
  return true;
}
