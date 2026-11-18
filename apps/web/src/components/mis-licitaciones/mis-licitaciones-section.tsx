"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import type { OfferCaseListItem } from "@/lib/queries";
import { cn } from "@/lib/cn";
import {
  PipelineBoard,
  type PipelineViewMode,
} from "@/components/mis-licitaciones/pipeline-board";
import { RecommendationsViewToggle } from "@/app/recommendations/recommendations-view-toggle";
import {
  applyMisLicitacionesFilters,
  countActiveMisLicitacionesFilters,
  EMPTY_MIS_LICITACIONES_FILTERS,
  ownerOptionsFromCases,
  type MisLicitacionesFilters,
} from "@/components/mis-licitaciones/mis-licitaciones-filters";
import {
  MisLicitacionesFiltersButton,
  MisLicitacionesFiltersModal,
} from "@/components/mis-licitaciones/mis-licitaciones-filters-modal";

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
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<MisLicitacionesFilters>(() => ({
    ...EMPTY_MIS_LICITACIONES_FILTERS,
    year: year ?? null,
  }));

  const ownerOptions = useMemo(() => ownerOptionsFromCases(cases), [cases]);
  const filtered = useMemo(
    () => applyMisLicitacionesFilters(cases, scope, filters),
    [cases, scope, filters],
  );
  const activeFilterCount = countActiveMisLicitacionesFilters(filters, scope);

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
          <MisLicitacionesFiltersButton
            activeCount={activeFilterCount}
            onClick={() => setFilterOpen(true)}
          />
        </div>
      </div>

      <div className="-mt-px">
        {filtered.length === 0 ? (
          cases.length === 0 ? (
            empty
          ) : (
            <div className="rounded-xl rounded-tl-none border border-dashed border-border bg-surface/60 px-6 py-10 text-center">
              <p className="text-sm font-medium text-foreground">
                Ningún expediente coincide con los filtros
              </p>
              <button
                type="button"
                className="mt-3 text-sm font-medium text-link hover:underline"
                onClick={() => setFilters(EMPTY_MIS_LICITACIONES_FILTERS)}
              >
                Limpiar filtros
              </button>
            </div>
          )
        ) : (
          <PipelineBoard scope={scope} cases={filtered} view={view} />
        )}
      </div>

      <MisLicitacionesFiltersModal
        open={filterOpen}
        scope={scope}
        years={years}
        ownerOptions={ownerOptions}
        applied={filters}
        onClose={() => setFilterOpen(false)}
        onApply={(next) => {
          setFilters(next);
          setFilterOpen(false);
        }}
        onClear={() => {
          setFilters(EMPTY_MIS_LICITACIONES_FILTERS);
          setFilterOpen(false);
        }}
      />
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
