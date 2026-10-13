"use client";

import { useMemo, useState } from "react";
import { useUndoToast } from "@/components/undo-toast";
import type { FavoriteWithTender } from "@/lib/queries";
import { FavoriteTenderList } from "./favorites-shared";

export const FAVORITES_PAGE_SIZE = 10;

/**
 * Lista paginada de licitaciones favoritas (10/pág).
 * Sin controles si hay 10 o menos.
 */
export function PaginatedFavoriteTenders({
  favorites,
  from = "favorites-tenders",
}: {
  favorites: FavoriteWithTender[];
  from?: "favorites" | "favorites-tenders";
}) {
  const { showStatus } = useUndoToast();
  const total = favorites.length;
  const totalPages = Math.max(1, Math.ceil(total / FAVORITES_PAGE_SIZE));
  const showPager = total > FAVORITES_PAGE_SIZE;

  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState("1");

  const pageItems = useMemo(() => {
    const safe = Math.min(Math.max(page, 1), totalPages);
    const start = (safe - 1) * FAVORITES_PAGE_SIZE;
    return favorites.slice(start, start + FAVORITES_PAGE_SIZE);
  }, [favorites, page, totalPages]);

  function applyPage(next: number) {
    const clamped = Math.min(Math.max(next, 1), totalPages);
    setPage(clamped);
    setDraft(String(clamped));
  }

  function commitDraft() {
    const n = Number.parseInt(draft.trim(), 10);
    if (!Number.isInteger(n) || n < 1 || n > totalPages) {
      setDraft(String(page));
      showStatus("Número de página inválido.");
      return;
    }
    applyPage(n);
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
        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-muted-foreground">
          <span>Página</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            step={1}
            value={draft}
            aria-label="Número de página"
            onChange={(e) => {
              const value = e.target.value;
              setDraft(value);
              const n = Number.parseInt(value, 10);
              if (Number.isInteger(n) && n >= 1 && n <= totalPages) {
                setPage(n);
              }
            }}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitDraft();
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="w-14 rounded-md border border-border bg-background px-2 py-1 text-center text-sm text-foreground tabular-nums outline-none focus:ring-2 focus:ring-ring"
          />
          <span>de</span>
          <span
            className="inline-flex min-w-14 items-center justify-center rounded-md border border-border bg-muted/40 px-2 py-1 text-sm tabular-nums text-foreground"
            aria-label="Total de páginas"
          >
            {totalPages}
          </span>
          <span aria-hidden>→</span>
          <span>
            <span className="font-medium text-foreground tabular-nums">
              {total}
            </span>{" "}
            licitaciones totales
          </span>
        </div>
      ) : null}
    </div>
  );
}
