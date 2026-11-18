"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { OfferCaseListItem } from "@/lib/queries";
import { cn } from "@/lib/cn";
import {
  PipelineBoard,
  type PipelineViewMode,
} from "@/components/mis-licitaciones/pipeline-board";
import { RecommendationsViewToggle } from "@/app/recommendations/recommendations-view-toggle";

type Scope = "active" | "historic";

/**
 * Misma geometría que Recomendaciones / FavoriteKindTabs:
 * pestañas a la izquierda; Lista|Kanban + Filtrar a la derecha.
 */
export function MisLicitacionesSection({
  scope,
  cases,
  years,
  year,
  empty,
}: {
  scope: Scope;
  cases: OfferCaseListItem[];
  years: number[];
  year: number | undefined;
  empty: ReactNode;
}) {
  const [view, setView] = useState<PipelineViewMode>("lista");

  return (
    <section>
      <div className="flex min-h-10 flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <div
          className="flex min-w-0 flex-wrap items-end gap-1 border-b border-border"
          role="tablist"
          aria-label="Ámbito de Mis licitaciones"
        >
          <ScopeTab
            href="/mis-licitaciones"
            active={scope === "active"}
            label="Activas"
          />
          <ScopeTab
            href="/mis-licitaciones?tab=historic"
            active={scope === "historic"}
            label="Histórico"
          />
        </div>

        <div className="mb-px flex shrink-0 items-center gap-3">
          {scope === "historic" && years.length > 0 ? (
            <div className="hidden flex-wrap gap-1.5 sm:flex">
              <YearChip href="/mis-licitaciones?tab=historic" active={!year}>
                Todos
              </YearChip>
              {years.map((y) => (
                <YearChip
                  key={y}
                  href={`/mis-licitaciones?tab=historic&year=${y}`}
                  active={year === y}
                >
                  {y}
                </YearChip>
              ))}
            </div>
          ) : null}
          <RecommendationsViewToggle view={view} onChange={setView} />
          <FiltersButton />
        </div>
      </div>

      <div className="-mt-px">
        {cases.length === 0 ? (
          empty
        ) : (
          <PipelineBoard scope={scope} cases={cases} view={view} />
        )}
      </div>
    </section>
  );
}

function ScopeTab({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={cn(
        "relative z-10 -mb-px inline-flex items-center gap-1.5 rounded-t-lg border px-3.5 py-2 text-sm font-medium transition-colors",
        active
          ? "border-border border-b-background bg-background text-foreground"
          : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}

/** Mismo look que Favoritos/Recomendaciones; sin modal todavía. */
function FiltersButton() {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center gap-2 px-1 py-2",
        "text-base font-medium text-primary-dark",
        "transition-colors hover:text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
      aria-label="Filtrar"
    >
      <FiltersIcon />
      Filtrar
    </button>
  );
}

function FiltersIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 shrink-0"
      aria-hidden
    >
      <path d="M4 7h16" />
      <circle cx="8" cy="7" r="2.25" fill="var(--surface)" />
      <path d="M4 12h16" />
      <circle cx="16" cy="12" r="2.25" fill="var(--surface)" />
      <path d="M4 17h16" />
      <circle cx="12" cy="17" r="2.25" fill="var(--surface)" />
    </svg>
  );
}

function YearChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium",
        active
          ? "border-primary/40 bg-primary/10 text-link"
          : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}
