"use client";

import { useEffect, useMemo, useState } from "react";
import type { FavoriteWithTender } from "@/lib/queries";
import { FavoriteTenderList } from "./favorites-shared";
import {
  DEFAULT_PAGE_SIZE,
  ListPager,
  type PageSize,
} from "./list-pager";

export const FAVORITES_PAGE_SIZE = DEFAULT_PAGE_SIZE;

/**
 * Lista paginada de licitaciones favoritas.
 * Controles solo si hay más de 10; tamaño de página 10 / 50 / 100.
 */
export function PaginatedFavoriteTenders({
  favorites,
  from = "favorites-tenders",
}: {
  favorites: FavoriteWithTender[];
  from?: "favorites" | "favorites-tenders";
}) {
  const total = favorites.length;
  const showPager = total > FAVORITES_PAGE_SIZE;

  const [pageSize, setPageSize] = useState<PageSize>(FAVORITES_PAGE_SIZE);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pageItems = useMemo(() => {
    const safe = Math.min(Math.max(page, 1), totalPages);
    const start = (safe - 1) * pageSize;
    return favorites.slice(start, start + pageSize);
  }, [favorites, page, pageSize, totalPages]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function onPageSizeChange(next: PageSize) {
    setPageSize(next);
    setPage(1);
  }

  return (
    <div>
      <div className="rounded-lg border border-border px-4">
        <FavoriteTenderList
          favorites={pageItems}
          from={from}
          bordered={false}
        />
      </div>

      {showPager ? (
        <ListPager
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          showing={pageItems.length}
          total={total}
          itemLabel="licitaciones"
          ariaPageSizeLabel="Licitaciones por página"
          onPageChange={setPage}
          onPageSizeChange={onPageSizeChange}
        />
      ) : null}
    </div>
  );
}
