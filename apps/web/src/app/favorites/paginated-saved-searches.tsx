"use client";

import { useEffect, useMemo, useState } from "react";
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
 * Con pager: panel con scroll interno + barra de paginación fija al pie del viewport.
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

  if (!showPager) {
    return (
      <div className="rounded-lg border border-border px-4">
        <SavedSearchList
          searches={pageItems}
          userId={userId}
          digestFrequency={digestFrequency}
          searchFrom={searchFrom}
          bordered={false}
        />
      </div>
    );
  }

  return (
    <>
      <div
        className="overflow-y-auto rounded-lg border border-border px-4"
        style={{ maxHeight: "calc(100dvh - 14rem)" }}
      >
        <SavedSearchList
          searches={pageItems}
          userId={userId}
          digestFrequency={digestFrequency}
          searchFrom={searchFrom}
          bordered={false}
        />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90">
        <div className="mx-auto max-w-6xl px-6 py-3">
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
        </div>
      </div>
    </>
  );
}
