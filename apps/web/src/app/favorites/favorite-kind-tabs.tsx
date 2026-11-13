"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  favoriteKindLongLabel,
  type FavoriteKind,
} from "@/lib/queries";

type FavoriteKindTab = "todas" | FavoriteKind;

/**
 * Pestañas Todas | Propias de Eficen | Subcontrata.
 * Solo si hay ítems en ambos kinds; si solo hay uno, lista directa sin pestañas.
 * El vacío total lo resuelve la página (mensaje «aún no hay…»).
 */
export function FavoriteKindTabs({
  ariaLabel,
  todas,
  propias,
  subcontratas,
  todasCount,
  propiasCount,
  subcontratasCount,
}: {
  ariaLabel: string;
  todas: ReactNode;
  propias: ReactNode;
  subcontratas: ReactNode;
  todasCount: number;
  propiasCount: number;
  subcontratasCount: number;
}) {
  const [tab, setTab] = useState<FavoriteKindTab>("todas");
  const showTabs = propiasCount > 0 && subcontratasCount > 0;

  if (!showTabs) {
    return <section>{todas}</section>;
  }

  return (
    <section>
      <div className="border-b border-border">
        <div
          className="flex flex-wrap items-end gap-1"
          role="tablist"
          aria-label={ariaLabel}
        >
          <KindTab
            label="Todas"
            active={tab === "todas"}
            count={todasCount}
            onSelect={() => setTab("todas")}
          />
          <KindTab
            label={favoriteKindLongLabel("propia")}
            active={tab === "propia"}
            count={propiasCount}
            onSelect={() => setTab("propia")}
          />
          <KindTab
            label={favoriteKindLongLabel("subcontrata")}
            active={tab === "subcontrata"}
            count={subcontratasCount}
            onSelect={() => setTab("subcontrata")}
          />
        </div>
      </div>

      <div className="-mt-px" role="tabpanel">
        {tab === "todas" ? todas : tab === "propia" ? propias : subcontratas}
      </div>
    </section>
  );
}

function KindTab({
  label,
  active,
  count,
  onSelect,
}: {
  label: string;
  active: boolean;
  count: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={cn(
        "relative z-10 -mb-px inline-flex items-center gap-1.5 rounded-t-lg border px-3.5 py-2 text-sm font-medium transition-colors",
        active
          ? "border-border border-b-background bg-background text-foreground"
          : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
      <span
        className={cn(
          "min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums",
          active
            ? "bg-primary/15 text-primary-dark"
            : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}
