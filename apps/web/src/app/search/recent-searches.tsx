"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { formatCriteriaSummary } from "@/lib/criteria-display";
import { searchHrefFromCriteria } from "@/app/favorites/favorites-shared";
import { cn } from "@/lib/cn";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  deleteOwnRecentSearch,
  type RecentSearch,
} from "@/lib/queries";
import { useSearchFormPreview } from "./search-form-preview";

/**
 * Historial discreto junto al marcador de guardar: «Búsquedas recientes»
 * despliega chips (máx. 5). Hover = preview fantasma; click = buscar.
 */
export function RecentSearchesList({
  items,
  trailing,
  municipalityNames = {},
}: {
  items: RecentSearch[];
  /** p. ej. marcador de guardar, centrado en altura con el enlace. */
  trailing?: ReactNode;
  /** Nombres de municipio por código INE (para el resumen del chip). */
  municipalityNames?: Readonly<Record<string, string>>;
}) {
  const { setPreview, clearPreview, scheduleClearPreview } =
    useSearchFormPreview();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(items);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    setList(items);
  }, [items]);

  useEffect(() => {
    if (!open) clearPreview();
  }, [open, clearPreview]);

  if (list.length === 0) {
    return trailing ? (
      <div className="flex w-full justify-end">{trailing}</div>
    ) : null;
  }

  async function onRemove(e: React.MouseEvent, recentId: string) {
    e.preventDefault();
    e.stopPropagation();
    clearPreview();
    if (pendingId) return;
    setPendingId(recentId);
    const client = createSupabaseBrowserClient();
    const { error } = await deleteOwnRecentSearch(client, { recentId });
    setPendingId(null);
    if (error) return;
    setList((prev) => prev.filter((i) => i.id !== recentId));
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5">
      <div className="flex w-full items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-1 text-sm font-medium leading-none text-muted-foreground transition-colors hover:text-foreground"
        >
          Búsquedas recientes
          <Chevron open={open} />
        </button>
        {trailing}
      </div>
      {open ? (
        <ul className="flex w-full flex-wrap justify-end gap-1.5 pl-14">
          {list.map((item) => {
            const summary = formatCriteriaSummary(item.criteria, {
              municipalityNames,
            });
            return (
              <li key={item.id} className="max-w-full">
                <span
                  className="inline-flex max-w-full items-center gap-0.5 rounded-md border border-border bg-muted/40 pl-2 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 sm:max-w-md"
                  onMouseEnter={() => setPreview(item.criteria)}
                  onMouseLeave={() => scheduleClearPreview()}
                >
                  <Link
                    href={searchHrefFromCriteria(item.criteria)}
                    className="min-w-0 truncate py-1 hover:text-primary-dark"
                  >
                    {summary}
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => void onRemove(e, item.id)}
                    onMouseEnter={() => scheduleClearPreview()}
                    disabled={pendingId === item.id}
                    aria-label={`Quitar «${summary}» del historial`}
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
