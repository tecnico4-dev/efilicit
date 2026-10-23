/** Tamaño de página del buscador (compartido server/client; sin "use client"). */
export const SEARCH_PAGE_SIZE = 10;

/** Construye href de `/search` preservando filtros y página. */
export function searchHref(
  filters: {
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
  },
  page: number,
  from?: string,
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
  if (from === "favorites" || from === "favorites-searches") {
    params.set("from", from);
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}
