import type { SearchTenderRow } from "@/lib/queries";
import type { SearchSortBy, SearchSortDir } from "./search-sort";

/**
 * Ordena el batch cacheado en cliente.
 * `relevance` = orden de la RPC (rank); asc = inverso.
 */
export function sortSearchRows(
  rows: SearchTenderRow[],
  sortBy: SearchSortBy,
  sortDir: SearchSortDir,
): SearchTenderRow[] {
  if (sortBy === "relevance") {
    return sortDir === "desc" ? [...rows] : [...rows].reverse();
  }

  const mul = sortDir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const cmp = compareField(a, b, sortBy);
    if (cmp !== 0) return cmp * mul;
    return a.id.localeCompare(b.id);
  });
}

function compareField(
  a: SearchTenderRow,
  b: SearchTenderRow,
  sortBy: Exclude<SearchSortBy, "relevance">,
): number {
  switch (sortBy) {
    case "title":
      return cmpString(a.title, b.title);
    case "status":
      return cmpString(a.status, b.status);
    case "procedure_type":
      return cmpString(a.procedure_type, b.procedure_type);
    case "contract_type":
      return cmpString(a.contract_type, b.contract_type);
    case "estimated_value":
      return cmpNumber(a.estimated_value, b.estimated_value);
    case "publication_date":
      return cmpString(a.publication_date, b.publication_date);
    case "deadline_at":
      return cmpString(a.deadline_at, b.deadline_at);
    case "created_at":
      return cmpString(a.created_at, b.created_at);
    case "updated_at":
      return cmpString(a.updated_at, b.updated_at);
    default:
      return 0;
  }
}

function cmpString(a: string | null | undefined, b: string | null | undefined): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a.localeCompare(b, "es", { sensitivity: "base" });
}

function cmpNumber(a: number | null | undefined, b: number | null | undefined): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}
