"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { FavoriteHeartButton } from "@/components/favorites/favorite-heart-button";
import { useUndoToast } from "@/components/undo-toast";
import { EmptyState, ErrorState } from "@/components/ui/state-message";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  listOwnFavoriteTenderIds,
  searchTenders,
  type SearchTenderRow,
} from "@/lib/queries";
import { formatCpvListPreview } from "@/lib/cpv";
import { formatTenderStatus } from "@/lib/tender-labels";
import type { SearchCriteria } from "@efilicit/types";
import {
  SEARCH_PAGE_SIZE,
  SEARCH_RESULTS_ANCHOR,
  type SearchHrefFilters,
  type SearchPageSize,
} from "./search-pagination";
import {
  getSearchResultCache,
  SEARCH_RESULT_CAP,
  setSearchResultCache,
} from "./search-result-cache";
import { SearchResultsPager } from "./search-results-pager";
import { ScrollToSearchResults } from "./scroll-to-search-results";
import { sortSearchRows } from "./sort-search-rows";
import type { SearchSortBy, SearchSortDir } from "./search-sort";

/** Evita repetir el toast al paginar/ordenar la misma búsqueda. */
const toastedCapKeys = new Set<string>();

function formatCountEs(n: number): string {
  return new Intl.NumberFormat("es-ES").format(n);
}

function formatMoney(value: number | null, currency: string): string {
  if (value == null) return "—";
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

/** Solo «errata» (trgm); FTS/filtro no se muestran al usuario. */
function MatchKindBadge({ kind }: { kind: string }) {
  if (kind !== "trgm") return null;
  return (
    <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
      errata
    </span>
  );
}

function tenderHrefFromSearch(
  tenderId: string,
  filters: SearchHrefFilters,
  page: number,
  pageSize: SearchPageSize,
  sortBy: SearchSortBy,
  sortDir: SearchSortDir,
): string {
  const params = new URLSearchParams({ from: "search" });
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
  if (page > 1) params.set("page", String(page));
  if (pageSize !== SEARCH_PAGE_SIZE) params.set("ps", String(pageSize));
  if (sortBy !== "relevance") params.set("sort", sortBy);
  if (sortDir !== "desc") params.set("dir", sortDir);
  return `/tenders/${tenderId}?${params.toString()}`;
}

export type SearchResultsPanelProps = {
  shouldSearch: boolean;
  /** Clave estable de criterios (sin page/sort/ps). */
  criteriaKey: string;
  query: string;
  /** Criteria sin `keywords` (la RPC usa `query`). */
  rpcCriteria: Partial<SearchCriteria>;
  filters: SearchHrefFilters;
  page: number;
  pageSize: SearchPageSize;
  sortBy: SearchSortBy;
  sortDir: SearchSortDir;
  from: string;
  profileUserId: string | null;
};

/**
 * Una RPC (top {@link SEARCH_RESULT_CAP} por relevancia) en caché de memoria;
 * paginación y orden en cliente sobre ese batch.
 */
export function SearchResultsPanel({
  shouldSearch,
  criteriaKey,
  query,
  rpcCriteria,
  filters,
  page,
  pageSize,
  sortBy,
  sortDir,
  from,
  profileUserId,
}: SearchResultsPanelProps) {
  const { showWarning } = useUndoToast();
  const cached = shouldSearch ? getSearchResultCache(criteriaKey) : null;
  const [rows, setRows] = useState<SearchTenderRow[] | null>(
    () => cached?.rows ?? null,
  );
  const [universeTotal, setUniverseTotal] = useState(
    () => cached?.universeTotal ?? 0,
  );
  const [loading, setLoading] = useState(
    () => shouldSearch && cached == null,
  );
  const [error, setError] = useState<string | null>(null);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const queryRef = useRef(query);
  const rpcCriteriaRef = useRef(rpcCriteria);
  queryRef.current = query;
  rpcCriteriaRef.current = rpcCriteria;

  function maybeToastCap(key: string, total: number) {
    if (total <= SEARCH_RESULT_CAP) return;
    if (toastedCapKeys.has(key)) return;
    toastedCapKeys.add(key);
    showWarning(
      `Se muestran las ${SEARCH_RESULT_CAP} más relevantes de ${formatCountEs(total)} resultados.\nRecomendación: endurecer los filtros usados.`,
    );
  }

  useEffect(() => {
    if (!shouldSearch) {
      setRows(null);
      setUniverseTotal(0);
      setError(null);
      setLoading(false);
      setFavoritedIds(new Set());
      return;
    }

    let cancelled = false;
    const client = createSupabaseBrowserClient();

    async function loadFavorites(batch: SearchTenderRow[]) {
      if (!profileUserId || batch.length === 0) {
        if (!cancelled) setFavoritedIds(new Set());
        return;
      }
      const fav = await listOwnFavoriteTenderIds(
        client,
        batch.map((r) => r.id),
      );
      if (!cancelled) setFavoritedIds(fav.data);
    }

    const hit = getSearchResultCache(criteriaKey);
    if (hit) {
      setRows(hit.rows);
      setUniverseTotal(hit.universeTotal);
      setError(null);
      setLoading(false);
      maybeToastCap(criteriaKey, hit.universeTotal);
      void loadFavorites(hit.rows);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError(null);
    setRows(null);
    setUniverseTotal(0);

    void searchTenders(client, {
      query: queryRef.current || undefined,
      criteria: rpcCriteriaRef.current,
      limit: SEARCH_RESULT_CAP,
      offset: 0,
      sortBy: "relevance",
      sortDir: "desc",
    }).then(async (result) => {
      if (cancelled) return;
      if (result.error) {
        setError(result.error.message);
        setRows([]);
        setUniverseTotal(0);
        setLoading(false);
        return;
      }
      const batch = (result.data ?? []).slice(0, SEARCH_RESULT_CAP);
      setSearchResultCache({
        key: criteriaKey,
        rows: batch,
        universeTotal: result.totalCount,
      });
      setRows(batch);
      setUniverseTotal(result.totalCount);
      setLoading(false);
      maybeToastCap(criteriaKey, result.totalCount);
      await loadFavorites(batch);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast/cap por criteriaKey
  }, [shouldSearch, criteriaKey, profileUserId]);

  const sorted = useMemo(
    () => (rows ? sortSearchRows(rows, sortBy, sortDir) : []),
    [rows, sortBy, sortDir],
  );

  const capped = universeTotal > SEARCH_RESULT_CAP;
  const displayTotal = sorted.length;
  const safePage =
    displayTotal === 0
      ? 1
      : Math.min(page, Math.max(1, Math.ceil(displayTotal / pageSize)));
  const pageRows = sorted.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  if (!shouldSearch) return null;

  if (error) {
    return <ErrorState className="mt-8">{error}</ErrorState>;
  }

  if (loading || rows == null) {
    return (
      <p
        id={SEARCH_RESULTS_ANCHOR}
        className="mt-8 scroll-mt-24 text-sm text-muted-foreground"
      >
        Buscando…
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState className="mt-8">
        Sin resultados para estos criterios.
      </EmptyState>
    );
  }

  const showPager = displayTotal > pageSize || safePage > 1;

  const list = (
    <ul className="divide-y divide-border">
      {pageRows.map((row) => (
        <li key={row.id} className="py-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="text-base font-medium text-foreground">
                  <Link
                    href={tenderHrefFromSearch(
                      row.id,
                      filters,
                      safePage,
                      pageSize,
                      sortBy,
                      sortDir,
                    )}
                    className="text-foreground hover:text-link hover:underline"
                  >
                    {row.title}
                  </Link>
                </h2>
                <MatchKindBadge kind={row.match_kind} />
              </div>
              <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <div>
                  <dt className="inline text-muted-foreground">Importe: </dt>
                  <dd className="inline">
                    {formatMoney(row.estimated_value, row.currency)}
                  </dd>
                </div>
                <div>
                  <dt className="inline text-muted-foreground">CPV: </dt>
                  <dd className="inline font-mono">
                    {formatCpvListPreview(row.cpv_codes)}
                  </dd>
                </div>
                <div>
                  <dt className="inline text-muted-foreground">Estado: </dt>
                  <dd className="inline">{formatTenderStatus(row.status)}</dd>
                </div>
              </dl>
            </div>
            {profileUserId ? (
              <FavoriteHeartButton
                userId={profileUserId}
                tenderId={row.id}
                tenderTitle={row.title}
                initiallyFavorited={favoritedIds.has(row.id)}
                onFavoritedChange={(id, next) => {
                  setFavoritedIds((prev) => {
                    const copy = new Set(prev);
                    if (next) copy.add(id);
                    else copy.delete(id);
                    return copy;
                  });
                }}
              />
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );

  const pager = (
    <SearchResultsPager
      page={safePage}
      pageSize={pageSize}
      showing={pageRows.length}
      total={displayTotal}
      capped={capped}
      filters={filters}
      from={from}
      sortBy={sortBy}
      sortDir={sortDir}
    />
  );

  if (!showPager) {
    return (
      <div id={SEARCH_RESULTS_ANCHOR} className="mt-8 scroll-mt-24">
        <ScrollToSearchResults />
        <div className="rounded-lg border border-border px-4">{list}</div>
      </div>
    );
  }

  return (
    <div id={SEARCH_RESULTS_ANCHOR} className="mt-8 scroll-mt-24">
      <ScrollToSearchResults />
      <div
        className="flex flex-col overflow-hidden rounded-lg border border-border"
        style={{ height: "calc(100dvh - 11.5rem)" }}
      >
        <div
          key={`${safePage}-${pageSize}-${sortBy}-${sortDir}`}
          className="min-h-0 flex-1 overflow-y-auto px-4"
        >
          {pageRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sin resultados en esta página.
            </p>
          ) : (
            list
          )}
        </div>
        <div className="shrink-0 border-t border-border bg-background px-4 py-3">
          {pager}
        </div>
      </div>
    </div>
  );
}
