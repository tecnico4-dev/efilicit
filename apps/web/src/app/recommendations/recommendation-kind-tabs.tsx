"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { favoriteKindLongLabel, type FavoriteKind } from "@/lib/queries";

type KindTab = "todas" | FavoriteKind;

/**
 * Pestañas Todas | Eficen | Subcontrata (sin Filtrar).
 * Solo si hay ítems en ambos kinds.
 */
export function RecommendationKindTabs({
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
  const [tab, setTab] = useState<KindTab>("todas");
  const showTabs = propiasCount > 0 && subcontratasCount > 0;

  return (
    <section>
      {showTabs ? (
        <div
          className="flex min-h-10 flex-wrap items-end gap-1 border-b border-border"
          role="tablist"
          aria-label={ariaLabel}
        >
          <KindTabButton
            label="Todas"
            active={tab === "todas"}
            count={todasCount}
            onSelect={() => setTab("todas")}
          />
          <KindTabButton
            label={favoriteKindLongLabel("propia")}
            active={tab === "propia"}
            count={propiasCount}
            onSelect={() => setTab("propia")}
          />
          <KindTabButton
            label={favoriteKindLongLabel("subcontrata")}
            active={tab === "subcontrata"}
            count={subcontratasCount}
            onSelect={() => setTab("subcontrata")}
          />
        </div>
      ) : null}

      <div
        className={showTabs ? "-mt-px" : undefined}
        role={showTabs ? "tabpanel" : undefined}
      >
        {showTabs
          ? tab === "todas"
            ? todas
            : tab === "propia"
              ? propias
              : subcontratas
          : todas}
      </div>
    </section>
  );
}

function KindTabButton({
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
