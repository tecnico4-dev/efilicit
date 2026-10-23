/** Ancla al inicio del listado (mantener scroll al cambiar de página). */
export const SEARCH_RESULTS_ANCHOR = "resultados";

/** Tamaños de página alineados con favoritos (`ListPager`). */
export const SEARCH_PAGE_SIZE_OPTIONS = [10, 50, 100] as const;
export type SearchPageSize = (typeof SEARCH_PAGE_SIZE_OPTIONS)[number];

/** Tamaño de página por defecto del buscador. */
export const SEARCH_PAGE_SIZE: SearchPageSize = 10;

export function parseSearchPageSize(raw: string): SearchPageSize {
  const n = Number.parseInt(raw.trim(), 10);
  if ((SEARCH_PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) {
    return n as SearchPageSize;
  }
  return SEARCH_PAGE_SIZE;
}

export type SearchHrefFilters = {
  q: string;
  cpvCodes: string[];
  cpvMatch: "any" | "all";
  minRaw: string;
  maxRaw: string;
  ccaa: string;
  municipality: string;
  status: string;
  procedure: string;
  contractType: string;
  pubFrom: string;
  pubTo: string;
  openForSubmission: boolean;
};

/** Construye href de `/search` preservando filtros, página y tamaño. */
export function searchHref(
  filters: SearchHrefFilters,
  page: number,
  options?: {
    from?: string;
    pageSize?: SearchPageSize;
    /** Incluir `#resultados` (paginación). */
    withAnchor?: boolean;
  },
): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  for (const code of filters.cpvCodes) params.append("cpv", code);
  if (filters.cpvCodes.length >= 2 && filters.cpvMatch === "all") {
    params.set("cpv_match", "all");
  }
  if (filters.minRaw) params.set("min", filters.minRaw);
  if (filters.maxRaw) params.set("max", filters.maxRaw);
  if (filters.ccaa) params.set("ccaa", filters.ccaa);
  if (filters.municipality) params.set("municipality", filters.municipality);
  if (filters.status) params.set("status", filters.status);
  if (filters.procedure) params.set("procedure", filters.procedure);
  if (filters.contractType) params.set("contract_type", filters.contractType);
  if (filters.pubFrom) params.set("pub_from", filters.pubFrom);
  if (filters.pubTo) params.set("pub_to", filters.pubTo);
  if (filters.openForSubmission) params.set("en_plazo", "1");
  const from = options?.from;
  if (from === "favorites" || from === "favorites-searches") {
    params.set("from", from);
  }
  const pageSize = options?.pageSize ?? SEARCH_PAGE_SIZE;
  if (pageSize !== SEARCH_PAGE_SIZE) {
    params.set("ps", String(pageSize));
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  const path = qs ? `/search?${qs}` : "/search";
  if (options?.withAnchor) {
    return `${path}#${SEARCH_RESULTS_ANCHOR}`;
  }
  return path;
}
