"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  favoriteKindLongLabel,
  type FavoriteKind,
} from "@/lib/queries";

/**
 * Pestañas Propias de Eficen | Subcontrata (mismo patrón que Mis alertas | Coincidencias).
 */
export function FavoriteKindTabs({
  ariaLabel,
  propias,
  subcontratas,
  propiasCount,
  subcontratasCount,
}: {
  ariaLabel: string;
  propias: ReactNode;
  subcontratas: ReactNode;
  propiasCount: number;
  subcontratasCount: number;
}) {
  const [tab, setTab] = useState<FavoriteKind>(() =>
    propiasCount === 0 && subcontratasCount > 0 ? "subcontrata" : "propia",
  );

  return (
    <section>
      <div className="border-b border-border">
        <div
          className="flex flex-wrap items-end gap-1"
          role="tablist"
          aria-label={ariaLabel}
        >
          <KindTab
            kind="propia"
            active={tab === "propia"}
            count={propiasCount}
            onSelect={() => setTab("propia")}
          />
          <KindTab
            kind="subcontrata"
            active={tab === "subcontrata"}
            count={subcontratasCount}
            onSelect={() => setTab("subcontrata")}
          />
        </div>
      </div>

      <div className="-mt-px" role="tabpanel">
        {tab === "propia" ? propias : subcontratas}
      </div>
    </section>
  );
}

function KindTab({
  kind,
  active,
  count,
  onSelect,
}: {
  kind: FavoriteKind;
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
      {favoriteKindLongLabel(kind)}
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
