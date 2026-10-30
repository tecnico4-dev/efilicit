"use client";

import Link from "next/link";
import { useState } from "react";
import { formatCriteriaSummary } from "@/lib/criteria-display";
import { searchHrefFromCriteria } from "@/app/favorites/favorites-shared";
import { cn } from "@/lib/cn";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  deleteOwnRecentSearch,
  type RecentSearch,
} from "@/lib/queries";

/**
 * Historial discreto: texto «Búsquedas recientes» que despliega chips (máx. 5).
 * Cada chip tiene × para quitarla del historial.
 */
export function RecentSearchesList({ items }: { items: RecentSearch[] }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(items);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    setList(items);
  }, [items]);

  if (list.length === 0) return null;

  async function onRemove(e: React.MouseEvent, recentId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (pendingId) return;
    setPendingId(recentId);
    const client = createSupabaseBrowserClient();
    const { error } = await deleteOwnRecentSearch(client, { recentId });
    setPendingId(null);
    if (error) return;
    setList((prev) => prev.filter((i) => i.id !== recentId));
  }

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
          {list.map((item) => {
            const summary = formatCriteriaSummary(item.criteria);
            return (
              <li key={item.id}>
                <span className="inline-flex max-w-[18rem] items-center gap-0.5 rounded-md border border-border bg-muted/40 pl-2 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10">
                  <Link
                    href={searchHrefFromCriteria(item.criteria)}
                    className="min-w-0 truncate py-1 hover:text-primary-dark"
                    title={summary}
                  >
                    {summary}
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => void onRemove(e, item.id)}
                    disabled={pendingId === item.id}
                    aria-label={`Quitar «${summary}» del historial`}
                    title="Quitar del historial"
                    className="shrink-0 rounded-r-md px-1.5 py-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                  >
                    ×
                  </button>
                </span>
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
