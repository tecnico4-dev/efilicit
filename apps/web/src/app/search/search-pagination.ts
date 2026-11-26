import {
  DEFAULT_SEARCH_SORT_BY,
  DEFAULT_SEARCH_SORT_DIR,
  type SearchSortBy,
  type SearchSortDir,
} from "./search-sort";

/** Ancla al inicio del listado (mantener scroll al cambiar de página). */
export const SEARCH_RESULTS_ANCHOR = "resultados";

/** Tamaños de página del buscador. */
export const SEARCH_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
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
  ccaaCodes: string[];
  municipality: string;
  statuses: string[];
  procedures: string[];
  contractTypes: string[];
  pubFrom: string;
  pubTo: string;
  openForSubmission: boolean;
};

/** Construye href de `/search` preservando filtros, página, tamaño y orden. */
export function searchHref(
  filters: SearchHrefFilters,
  page: number,
  options?: {
    from?: string;
    pageSize?: SearchPageSize;
    /** Incluir `#resultados` (paginación). */
    withAnchor?: boolean;
    /**
     * Total de la 1.ª búsqueda (`?tc=`). Evita recount en la RPC al paginar.
     * El submit del formulario no lo envía → se recalcula al buscar de nuevo.
     */
    totalCount?: number;
    sortBy?: SearchSortBy;
    sortDir?: SearchSortDir;
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
  for (const c of filters.ccaaCodes) params.append("ccaa", c);
  if (filters.municipality) params.set("municipality", filters.municipality);
  for (const s of filters.statuses) params.append("status", s);
  for (const p of filters.procedures) params.append("procedure", p);
  for (const c of filters.contractTypes) params.append("contract_type", c);
  if (filters.pubFrom) params.set("pub_from", filters.pubFrom);
  if (filters.pubTo) params.set("pub_to", filters.pubTo);
  params.set("en_plazo", filters.openForSubmission ? "1" : "0");
  const from = options?.from;
  if (from === "favorites" || from === "favorites-searches") {
    params.set("from", from);
  }
  const pageSize = options?.pageSize ?? SEARCH_PAGE_SIZE;
  if (pageSize !== SEARCH_PAGE_SIZE) {
    params.set("ps", String(pageSize));
  }
  if (page > 1) params.set("page", String(page));
  const tc = options?.totalCount;
  if (tc != null && Number.isFinite(tc) && tc >= 0) {
    params.set("tc", String(Math.floor(tc)));
  }
  const sortBy = options?.sortBy ?? DEFAULT_SEARCH_SORT_BY;
  const sortDir = options?.sortDir ?? DEFAULT_SEARCH_SORT_DIR;
  if (sortBy !== DEFAULT_SEARCH_SORT_BY) params.set("sort", sortBy);
  if (sortDir !== DEFAULT_SEARCH_SORT_DIR) params.set("dir", sortDir);
  const qs = params.toString();
  const path = qs ? `/search?${qs}` : "/search";
  if (options?.withAnchor) {
    return `${path}#${SEARCH_RESULTS_ANCHOR}`;
  }
  return path;
}
