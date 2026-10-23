"use client";

import { useRouter } from "next/navigation";
import { ListPager } from "@/app/favorites/list-pager";
import {
  SEARCH_PAGE_SIZE_OPTIONS,
  searchHref,
  type SearchHrefFilters,
  type SearchPageSize,
} from "./search-pagination";

export { SEARCH_PAGE_SIZE, searchHref } from "./search-pagination";

/**
 * Controles de paginación del buscador: mismo UI que favoritos (`ListPager`).
 * Navega por URL (`page` / `ps`) y ancla `#resultados`.
 */
export function SearchResultsPager({
  page,
  pageSize,
  showing,
  total,
  filters,
  from: searchFrom,
}: {
  page: number;
  pageSize: SearchPageSize;
  showing: number;
  total: number;
  filters: SearchHrefFilters;
  from?: string;
}) {
  const router = useRouter();
  const totalPages = Math.max(1, Math.ceil(Math.max(total, 1) / pageSize));

  if (total <= 0 && page <= 1) return null;
  if (total <= pageSize && page <= 1) return null;

  function go(nextPage: number, nextSize: SearchPageSize = pageSize) {
    const href = searchHref(filters, nextPage, {
      from: searchFrom,
      pageSize: nextSize,
      withAnchor: true,
      totalCount: total > 0 ? total : undefined,
    });
    router.push(href, { scroll: false });
  }

  return (
    <ListPager
      page={Math.min(Math.max(page, 1), totalPages)}
      totalPages={totalPages}
      pageSize={pageSize}
      showing={showing}
      total={total}
      itemLabel="licitaciones"
      ariaPageSizeLabel="Licitaciones por página"
      pageSizeOptions={SEARCH_PAGE_SIZE_OPTIONS}
      onPageChange={(p) => go(p)}
      onPageSizeChange={(size) => go(1, size as SearchPageSize)}
    />
  );
}
