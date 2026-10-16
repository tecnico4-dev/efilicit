"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import type { DigestFrequency } from "@/lib/queries";
import type { Database } from "@efilicit/types";
import { SavedSearchList } from "./favorites-shared";
import {
  DEFAULT_PAGE_SIZE,
  ListPager,
  type PageSize,
} from "./list-pager";

export const SAVED_SEARCHES_PAGE_SIZE = DEFAULT_PAGE_SIZE;

type SavedSearchRow = Database["public"]["Tables"]["saved_searches"]["Row"];

/**
 * Lista paginada de búsquedas guardadas.
 * Controles solo si hay más de 10; tamaño de página 10 / 50 / 100.
 * Con pager: lista con scroll interno y controles fijos al pie del layout.
 */
export function PaginatedSavedSearches({
  searches,
  userId,
  digestFrequency,
  searchFrom = "favorites-searches",
}: {
  searches: SavedSearchRow[];
  userId: string;
  digestFrequency: DigestFrequency;
  searchFrom?: "favorites" | "favorites-searches";
}) {
  const total = searches.length;
  const showPager = total > SAVED_SEARCHES_PAGE_SIZE;

  const [pageSize, setPageSize] = useState<PageSize>(SAVED_SEARCHES_PAGE_SIZE);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pageItems = useMemo(() => {
    const safe = Math.min(Math.max(page, 1), totalPages);
    const start = (safe - 1) * pageSize;
    return searches.slice(start, start + pageSize);
  }, [searches, page, pageSize, totalPages]);

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
    <div
      className={cn(showPager && "flex min-h-0 flex-1 flex-col")}
    >
      <div
        className={cn(
          "rounded-lg border border-border px-4",
          showPager && "min-h-0 flex-1 overflow-y-auto",
        )}
      >
        <SavedSearchList
          searches={pageItems}
          userId={userId}
          digestFrequency={digestFrequency}
          searchFrom={searchFrom}
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
          itemLabel="búsquedas"
          ariaPageSizeLabel="Búsquedas por página"
          onPageChange={setPage}
          onPageSizeChange={onPageSizeChange}
        />
      ) : null}
    </div>
  );
}
