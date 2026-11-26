"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import {
  SEARCH_SORT_OPTIONS,
  searchSortLabel,
  type SearchSortBy,
  type SearchSortDir,
} from "./search-sort";

/**
 * «Ordenar por» + flecha asc/desc: un solo rectángulo visual, dos zonas.
 * Menú del campo hacia arriba.
 */
export function SearchSortControl({
  sortBy,
  sortDir,
  onSortByChange,
  onSortDirToggle,
}: {
  sortBy: SearchSortBy;
  sortDir: SearchSortDir;
  onSortByChange: (next: SearchSortBy) => void;
  onSortDirToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const dirLabel =
    sortDir === "asc" ? "Orden ascendente" : "Orden descendente";
  const arrow = sortDir === "asc" ? "↑" : "↓";

  return (
    <div className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
      <span>Ordenar por:</span>
      <div className="relative inline-flex h-8" ref={menuRef}>
        <div className="inline-flex h-8 overflow-hidden rounded-md border border-border bg-background">
          <button
            type="button"
            aria-label="Campo de ordenación"
            aria-expanded={open}
            aria-haspopup="listbox"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex min-w-36 max-w-[14rem] items-center gap-1 px-2 text-sm hover:bg-muted focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring"
          >
            <span className="truncate font-medium text-foreground">
              {searchSortLabel(sortBy)}
            </span>
            <span aria-hidden className="shrink-0 text-xs text-muted-foreground">
              ▴
            </span>
          </button>
          <button
            type="button"
            aria-label={dirLabel}
            title={dirLabel}
            onClick={onSortDirToggle}
            className="inline-flex w-6 shrink-0 items-center justify-center border-l border-border text-sm leading-none text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring"
          >
            <span aria-hidden>{arrow}</span>
          </button>
        </div>
        {open ? (
          <ul
            role="listbox"
            className="absolute bottom-full left-0 z-30 mb-1 max-h-64 min-w-full overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-lg"
          >
            {SEARCH_SORT_OPTIONS.map((opt) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={sortBy === opt.value}
              >
                <button
                  type="button"
                  className={cn(
                    "block w-full whitespace-nowrap px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted",
                    sortBy === opt.value && "bg-muted font-medium",
                  )}
                  onClick={() => {
                    onSortByChange(opt.value);
                    setOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
