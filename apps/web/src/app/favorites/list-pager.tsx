"use client";

import { useEffect, useRef, useState } from "react";
import { useUndoToast } from "@/components/undo-toast";
import { cn } from "@/lib/cn";

export const PAGE_SIZE_OPTIONS = [10, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 10;

export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

/**
 * Controles de paginación: página editable + tamaño por página (menú hacia arriba).
 */
export function ListPager({
  page,
  totalPages,
  pageSize,
  showing,
  total,
  itemLabel,
  ariaPageSizeLabel,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}: {
  page: number;
  totalPages: number;
  pageSize: number;
  showing: number;
  total: number;
  /** Ej. «licitaciones» o «búsquedas». */
  itemLabel: string;
  ariaPageSizeLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  /** Opciones del menú «Mostrando»; por defecto 10 / 50 / 100. */
  pageSizeOptions?: readonly number[];
}) {
  const { showStatus } = useUndoToast();
  const [draft, setDraft] = useState(String(page));
  const [sizeOpen, setSizeOpen] = useState(false);
  const sizeMenuRef = useRef<HTMLDivElement>(null);

  const atFirst = page <= 1;
  const atLast = page >= totalPages;

  useEffect(() => {
    setDraft(String(page));
  }, [page]);

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
    onPageChange(clamped);
    setDraft(String(clamped));
  }

  function commitDraft() {
    const n = Number.parseInt(draft.trim(), 10);
    if (!Number.isInteger(n) || n < 1 || n > totalPages) {
      setDraft(String(page));
      showStatus("Número de página inválido.");
      return;
    }
    if (n === page) {
      setDraft(String(page));
      return;
    }
    applyPage(n);
  }

  function onSelectPageSize(next: number) {
    onPageSizeChange(next);
    setSizeOpen(false);
  }

  const boxClass =
    "inline-flex min-w-14 items-center justify-center rounded-md border border-border bg-background px-2 py-1 text-sm tabular-nums text-foreground";

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-muted-foreground">
      <span>Página</span>
      <div className="inline-flex items-center gap-0.5">
        <button
          type="button"
          aria-label="Página anterior"
          disabled={atFirst}
          onClick={() => applyPage(page - 1)}
          className={cn(
            "inline-flex h-8 w-7 items-center justify-center text-lg leading-none",
            atFirst
              ? "cursor-not-allowed text-muted-foreground/35"
              : "text-foreground hover:text-primary",
          )}
        >
          ‹
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={draft}
          aria-label="Número de página"
          onChange={(e) => setDraft(e.target.value)}
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
            "inline-flex h-8 w-7 items-center justify-center text-lg leading-none",
            atLast
              ? "cursor-not-allowed text-muted-foreground/35"
              : "text-foreground hover:text-primary",
          )}
        >
          ›
        </button>
      </div>
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
            aria-label={ariaPageSizeLabel}
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
              ▴
            </span>
          </button>
          {sizeOpen ? (
            <ul
              role="listbox"
              className="absolute bottom-full left-0 z-20 mb-1 min-w-full overflow-hidden rounded-md border border-border bg-surface py-1 shadow-lg"
            >
              {pageSizeOptions.map((opt) => (
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
          <span className="font-medium text-foreground tabular-nums">{total}</span>{" "}
          {itemLabel} totales
        </span>
      </span>
    </div>
  );
}
