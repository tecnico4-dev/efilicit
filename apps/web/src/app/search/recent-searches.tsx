"use client";

import Link from "next/link";
import { useState } from "react";
import { formatCriteriaSummary } from "@/lib/criteria-display";
import { searchHrefFromCriteria } from "@/app/favorites/favorites-shared";
import { cn } from "@/lib/cn";
import type { RecentSearch } from "@/lib/queries";

/**
 * Historial discreto: texto «Búsquedas recientes» que despliega chips (máx. 5).
 */
export function RecentSearchesList({ items }: { items: RecentSearch[] }) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <div className="min-w-0 flex-1 self-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Búsquedas recientes
        <Chevron open={open} />
      </button>
      {open ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {items.map((item) => {
            const summary = formatCriteriaSummary(item.criteria);
            return (
              <li key={item.id}>
                <Link
                  href={searchHrefFromCriteria(item.criteria)}
                  className="inline-block max-w-[16rem] truncate rounded-md border border-border bg-muted/40 px-2 py-1 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary-dark"
                  title={summary}
                >
                  {summary}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn(
        "transition-transform duration-150",
        open ? "rotate-180" : "rotate-0",
      )}
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}
