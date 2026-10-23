import Link from "next/link";

export const SEARCH_PAGE_SIZE = 20;

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

/**
 * Paginación servidor (Links) de resultados de búsqueda: 20 por página.
 * Sin total exacto: `hasNext` viene de pedir limit+1 a la RPC.
 */
export function SearchResultsPager({
  page,
  pageSize,
  showing,
  hasNext,
  hrefForPage,
}: {
  page: number;
  pageSize: number;
  showing: number;
  hasNext: boolean;
  hrefForPage: (page: number) => string;
}) {
  if (page <= 1 && !hasNext && showing === 0) return null;
  if (page <= 1 && !hasNext) return null;

  const from = showing === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = (page - 1) * pageSize + showing;
  const atFirst = page <= 1;

  const navClass = (disabled: boolean) =>
    disabled
      ? "cursor-not-allowed text-muted-foreground/35"
      : "text-foreground hover:text-primary";

  return (
    <nav
      className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm text-muted-foreground"
      aria-label="Paginación de resultados"
    >
      <p>
        {showing === 0 ? (
          <>Sin resultados en esta página.</>
        ) : (
          <>
            Mostrando{" "}
            <span className="font-medium tabular-nums text-foreground">
              {from}–{to}
            </span>
          </>
        )}
      </p>
      <div className="inline-flex items-center gap-2">
        {atFirst ? (
          <span className={navClass(true)} aria-disabled>
            ← Anterior
          </span>
        ) : (
          <Link
            href={hrefForPage(page - 1)}
            className={navClass(false)}
            rel="prev"
          >
            ← Anterior
          </Link>
        )}
        <span className="tabular-nums text-foreground">Página {page}</span>
        {hasNext ? (
          <Link
            href={hrefForPage(page + 1)}
            className={navClass(false)}
            rel="next"
          >
            Siguiente →
          </Link>
        ) : (
          <span className={navClass(true)} aria-disabled>
            Siguiente →
          </span>
        )}
      </div>
    </nav>
  );
}
