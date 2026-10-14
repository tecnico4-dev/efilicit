"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useUndoToast } from "@/components/undo-toast";
import { cn } from "@/lib/cn";
import type { FavoriteWithTender } from "@/lib/queries";
import { FavoriteTenderList } from "./favorites-shared";

const PAGE_SIZE_OPTIONS = [10, 50, 100] as const;
export const FAVORITES_PAGE_SIZE = 10;

type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

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
  const { showStatus } = useUndoToast();
  const total = favorites.length;
  const showPager = total > FAVORITES_PAGE_SIZE;

  const [pageSize, setPageSize] = useState<PageSize>(FAVORITES_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState("1");
  const [sizeOpen, setSizeOpen] = useState(false);
  const sizeMenuRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pageItems = useMemo(() => {
    const safe = Math.min(Math.max(page, 1), totalPages);
    const start = (safe - 1) * pageSize;
    return favorites.slice(start, start + pageSize);
  }, [favorites, page, pageSize, totalPages]);

  const showing = pageItems.length;
  const atFirst = page <= 1;
  const atLast = page >= totalPages;

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
      setDraft(String(totalPages));
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (!sizeOpen) return;
    function onDocClick(e: MouseEvent) {
      if (
        sizeMenuRef.current &&
        !sizeMenuRef.current.contains(e.target as Node)
      ) {
        setSizeOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [sizeOpen]);

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

  function onSelectPageSize(next: PageSize) {
    setPageSize(next);
    setPage(1);
    setDraft("1");
    setSizeOpen(false);
  }

  const boxClass =
    "inline-flex min-w-14 items-center justify-center rounded-md border border-border bg-background px-2 py-1 text-sm tabular-nums text-foreground";

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
          <button
            type="button"
            aria-label="Página anterior"
            disabled={atFirst}
            onClick={() => applyPage(page - 1)}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-base leading-none",
              atFirst
                ? "cursor-not-allowed text-muted-foreground/40"
                : "bg-background text-foreground hover:bg-muted",
            )}
          >
            ‹
          </button>
          <input
            type="text"
            inputMode="numeric"
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
            className={cn(boxClass, "w-14 outline-none focus:ring-2 focus:ring-ring")}
          />
          <button
            type="button"
            aria-label="Página siguiente"
            disabled={atLast}
            onClick={() => applyPage(page + 1)}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-base leading-none",
              atLast
                ? "cursor-not-allowed text-muted-foreground/40"
                : "bg-background text-foreground hover:bg-muted",
            )}
          >
            ›
          </button>
          <span>de</span>
          <span className={cn(boxClass, "bg-muted/40")} aria-label="Total de páginas">
            {totalPages}
          </span>
          <span aria-hidden>→</span>
          <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span>Mostrando</span>
            <div className="relative" ref={sizeMenuRef}>
              <button
                type="button"
                aria-label="Licitaciones por página"
                aria-expanded={sizeOpen}
                aria-haspopup="listbox"
                onClick={() => setSizeOpen((o) => !o)}
                className={cn(
                  boxClass,
                  "min-w-14 gap-1 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring",
                )}
              >
                <span className="font-medium tabular-nums">{showing}</span>
                <span aria-hidden className="text-xs text-muted-foreground">
                  ▾
                </span>
              </button>
              {sizeOpen ? (
                <ul
                  role="listbox"
                  className="absolute left-0 top-full z-20 mt-1 min-w-full overflow-hidden rounded-md border border-border bg-surface py-1 shadow-lg"
                >
                  {PAGE_SIZE_OPTIONS.map((opt) => (
                    <li key={opt} role="option" aria-selected={pageSize === opt}>
                      <button
                        type="button"
                        className={cn(
                          "block w-full px-3 py-1.5 text-left text-sm tabular-nums text-foreground hover:bg-muted",
                          pageSize === opt && "bg-muted font-medium",
                        )}
                        onClick={() => onSelectPageSize(opt)}
                      >
                        {opt}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <span>
              de{" "}
              <span className="font-medium text-foreground tabular-nums">
                {total}
              </span>{" "}
              licitaciones totales
            </span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
