"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUndoToast } from "@/components/undo-toast";
import { cn } from "@/lib/cn";
import { searchHref } from "./search-pagination";

export { SEARCH_PAGE_SIZE, searchHref } from "./search-pagination";

type SearchPagerFilters = Parameters<typeof searchHref>[0];

/**
 * Paginación de resultados: 10/página, total, página editable.
 * Móvil: «1–10 / X» y flechas ← →; desktop: texto completo.
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
  pageSize: number;
  showing: number;
  total: number;
  filters: SearchPagerFilters;
  from?: string;
}) {
  const router = useRouter();
  const { showStatus } = useUndoToast();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [draft, setDraft] = useState(String(page));

  useEffect(() => {
    setDraft(String(page));
  }, [page]);

  if (total <= 0 && page <= 1) return null;

  const from = showing === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = (page - 1) * pageSize + showing;
  const atFirst = page <= 1;
  const atLast = page >= totalPages;

  function hrefForPage(p: number) {
    return searchHref(filters, p, searchFrom);
  }

  function goToPage(next: number) {
    const clamped = Math.min(Math.max(next, 1), totalPages);
    if (clamped === page) {
      setDraft(String(page));
      return;
    }
    router.push(hrefForPage(clamped));
  }

  function commitDraft() {
    const n = Number.parseInt(draft.trim(), 10);
    if (!Number.isInteger(n) || n < 1 || n > totalPages) {
      setDraft(String(page));
      showStatus("Número de página inválido.");
      return;
    }
    goToPage(n);
  }

  const navClass = (disabled: boolean) =>
    disabled
      ? "cursor-not-allowed text-muted-foreground/35"
      : "text-foreground hover:text-primary";

  const pageInput = (
    <span className="inline-flex items-center gap-1.5 tabular-nums text-foreground">
      <span>Página</span>
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        aria-label={`Número de página (1 a ${totalPages})`}
        onChange={(e) => {
          const value = e.target.value;
          setDraft(value);
          const n = Number.parseInt(value, 10);
          if (Number.isInteger(n) && n >= 1 && n <= totalPages) {
            goToPage(n);
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
        className="inline-flex h-8 w-12 items-center justify-center rounded-md border border-border bg-background px-1 text-center text-sm tabular-nums text-foreground outline-none focus:ring-2 focus:ring-ring"
      />
    </span>
  );

  return (
    <nav
      className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm text-muted-foreground"
      aria-label="Paginación de resultados"
    >
      <p>
        {showing === 0 ? (
          <>Sin resultados en esta página.</>
        ) : (
          <>
            <span className="sm:hidden">
              Mostrando{" "}
              <span className="font-medium tabular-nums text-foreground">
                {from}–{to}
              </span>{" "}
              /{" "}
              <span className="font-medium tabular-nums text-foreground">
                {total}
              </span>
            </span>
            <span className="hidden sm:inline">
              Mostrando{" "}
              <span className="font-medium tabular-nums text-foreground">
                {from}–{to}
              </span>{" "}
              de{" "}
              <span className="font-medium tabular-nums text-foreground">
                {total}
              </span>{" "}
              licitaciones
            </span>
          </>
        )}
      </p>
      {totalPages > 1 || page > 1 ? (
        <div className="inline-flex items-center gap-2">
          {atFirst ? (
            <>
              <span className={cn(navClass(true), "sm:hidden")} aria-disabled>
                ←
              </span>
              <span
                className={cn(navClass(true), "hidden sm:inline")}
                aria-disabled
              >
                ← Anterior
              </span>
            </>
          ) : (
            <>
              <Link
                href={hrefForPage(page - 1)}
                className={cn(navClass(false), "sm:hidden")}
                rel="prev"
                aria-label="Página anterior"
              >
                ←
              </Link>
              <Link
                href={hrefForPage(page - 1)}
                className={cn(navClass(false), "hidden sm:inline")}
                rel="prev"
              >
                ← Anterior
              </Link>
            </>
          )}
          {pageInput}
          {atLast ? (
            <>
              <span className={cn(navClass(true), "sm:hidden")} aria-disabled>
                →
              </span>
              <span
                className={cn(navClass(true), "hidden sm:inline")}
                aria-disabled
              >
                Siguiente →
              </span>
            </>
          ) : (
            <>
              <Link
                href={hrefForPage(page + 1)}
                className={cn(navClass(false), "sm:hidden")}
                rel="next"
                aria-label="Página siguiente"
              >
                →
              </Link>
              <Link
                href={hrefForPage(page + 1)}
                className={cn(navClass(false), "hidden sm:inline")}
                rel="next"
              >
                Siguiente →
              </Link>
            </>
          )}
        </div>
      ) : null}
    </nav>
  );
}
