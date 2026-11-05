/**
 * Ordenación del buscador (URL `sort` / `dir` + RPC `p_sort_by` / `p_sort_dir`).
 * Default = relevancia (comportamiento histórico de search_tenders).
 */

export const SEARCH_SORT_DIR_OPTIONS = ["asc", "desc"] as const;
export type SearchSortDir = (typeof SEARCH_SORT_DIR_OPTIONS)[number];

export const SEARCH_SORT_OPTIONS = [
  { value: "relevance", label: "Relevancia" },
  { value: "title", label: "Título" },
  { value: "status", label: "Estado" },
  { value: "procedure_type", label: "Procedimiento" },
  { value: "contract_type", label: "Tipo de contrato" },
  { value: "estimated_value", label: "Importe" },
  { value: "publication_date", label: "Fecha de publicación" },
  { value: "deadline_at", label: "Fecha límite" },
  { value: "created_at", label: "Alta en EfiLicit" },
  { value: "updated_at", label: "Actualización" },
] as const;

export type SearchSortBy = (typeof SEARCH_SORT_OPTIONS)[number]["value"];

export const DEFAULT_SEARCH_SORT_BY: SearchSortBy = "relevance";
export const DEFAULT_SEARCH_SORT_DIR: SearchSortDir = "desc";

const SORT_BY_SET = new Set<string>(
  SEARCH_SORT_OPTIONS.map((o) => o.value),
);

export function parseSearchSortBy(raw: string): SearchSortBy {
  const v = raw.trim().toLowerCase();
  if (SORT_BY_SET.has(v)) return v as SearchSortBy;
  return DEFAULT_SEARCH_SORT_BY;
}

export function parseSearchSortDir(raw: string): SearchSortDir {
  const v = raw.trim().toLowerCase();
  if (v === "asc" || v === "desc") return v;
  return DEFAULT_SEARCH_SORT_DIR;
}

export function searchSortLabel(sortBy: SearchSortBy): string {
  return (
    SEARCH_SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Relevancia"
  );
}
