"use client";

import { useRouter } from "next/navigation";
import { ListPager } from "@/app/favorites/list-pager";
import {
  SEARCH_PAGE_SIZE_OPTIONS,
  searchHref,
  type SearchHrefFilters,
  type SearchPageSize,
} from "./search-pagination";
import { SearchSortControl } from "./search-sort-control";
import type { SearchSortBy, SearchSortDir } from "./search-sort";

export { SEARCH_PAGE_SIZE, searchHref } from "./search-pagination";

/**
 * Controles de paginación del buscador: mismo UI que favoritos (`ListPager`)
 * + «Ordenar por» a la derecha. Navega por URL (`page` / `ps` / `sort` / `dir`).
 */
export function SearchResultsPager({
  page,
  pageSize,
  showing,
  total,
  capped = false,
  filters,
  from: searchFrom,
  sortBy,
  sortDir,
}: {
  page: number;
  pageSize: SearchPageSize;
  showing: number;
  total: number;
  /** true = batch top-K; el pager dice «acotadas» en lugar de «totales». */
  capped?: boolean;
  filters: SearchHrefFilters;
  from?: string;
  sortBy: SearchSortBy;
  sortDir: SearchSortDir;
}) {
  const router = useRouter();
  const totalPages = Math.max(1, Math.ceil(Math.max(total, 1) / pageSize));

  if (total <= 0 && page <= 1) return null;
  if (total <= pageSize && page <= 1) return null;

  function go(opts: {
    nextPage?: number;
    nextSize?: SearchPageSize;
    nextSortBy?: SearchSortBy;
    nextSortDir?: SearchSortDir;
  }) {
    const href = searchHref(filters, opts.nextPage ?? page, {
      from: searchFrom,
      pageSize: opts.nextSize ?? pageSize,
      withAnchor: true,
      totalCount: total > 0 ? total : undefined,
      sortBy: opts.nextSortBy ?? sortBy,
      sortDir: opts.nextSortDir ?? sortDir,
    });
    router.push(href, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <ListPager
        page={Math.min(Math.max(page, 1), totalPages)}
        totalPages={totalPages}
        pageSize={pageSize}
        showing={showing}
        total={total}
        itemLabel="licitaciones"
        totalQualifier={capped ? "acotadas" : "totales"}
        ariaPageSizeLabel="Licitaciones por página"
        pageSizeOptions={SEARCH_PAGE_SIZE_OPTIONS}
        onPageChange={(p) => go({ nextPage: p })}
        onPageSizeChange={(size) =>
          go({ nextPage: 1, nextSize: size as SearchPageSize })
        }
      />
      <SearchSortControl
        sortBy={sortBy}
        sortDir={sortDir}
        onSortByChange={(next) => go({ nextPage: 1, nextSortBy: next })}
        onSortDirToggle={() =>
          go({
            nextPage: 1,
            nextSortDir: sortDir === "asc" ? "desc" : "asc",
          })
        }
      />
    </div>
  );
}
