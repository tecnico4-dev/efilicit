import type { SearchTenderRow } from "@/lib/queries";

/** Tope de filas por búsqueda (RPC una vez; paginar/ordenar en cliente). */
export const SEARCH_RESULT_CAP = 100;

export type SearchResultCacheEntry = {
  key: string;
  rows: SearchTenderRow[];
  /** Total del universo RPC (puede ser > CAP); UI de “N de M” más adelante. */
  universeTotal: number;
};

/** Caché en memoria del bundle (vive mientras no se recargue la pestaña). */
let memoryCache: SearchResultCacheEntry | null = null;

export function getSearchResultCache(
  key: string,
): SearchResultCacheEntry | null {
  if (!memoryCache || memoryCache.key !== key) return null;
  return memoryCache;
}

export function setSearchResultCache(entry: SearchResultCacheEntry) {
  memoryCache = entry;
}

export function clearSearchResultCache() {
  memoryCache = null;
}
