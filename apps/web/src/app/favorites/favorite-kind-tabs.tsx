"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useState, type ReactNode } from "react";
import {
  CriteriaFilters,
  type CriteriaFilterOptionsProp,
} from "@/components/criteria/criteria-filters";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { buildCriteriaFromSearchForm } from "@/lib/build-criteria-from-form";
import {
  criteriaToFilterInitial,
  emptyCriteriaFilterInitial,
  type CriteriaFilterInitial,
} from "@/lib/criteria-display";
import {
  favoriteKindLongLabel,
  type FavoriteKind,
} from "@/lib/queries";
import type { SearchCriteria } from "@efilicit/types";
import { countActiveFavoriteFilters } from "./favorites-list-filter";

type FavoriteKindTab = "todas" | FavoriteKind;

const FAVORITES_FILTER_FORM_ID = "favorites-filter-form";

function emptyFavoritesFilterInitial(): CriteriaFilterInitial {
  return {
    ...emptyCriteriaFilterInitial(),
    openForSubmission: false,
  };
}

/**
 * Pestañas Todas | Eficen | Subcontrata (+ Filtrar a la derecha).
 * Pestañas solo si hay ítems en ambos kinds; Filtrar siempre con lista.
 */
export function FavoriteKindTabs({
  ariaLabel,
  todas,
  propias,
  subcontratas,
  todasCount,
  propiasCount,
  subcontratasCount,
  filterOptions,
  appliedCriteria,
  onApplyFilters,
}: {
  ariaLabel: string;
  todas: ReactNode;
  propias: ReactNode;
  subcontratas: ReactNode;
  todasCount: number;
  propiasCount: number;
  subcontratasCount: number;
  filterOptions: CriteriaFilterOptionsProp;
  appliedCriteria: SearchCriteria | null;
  onApplyFilters: (criteria: SearchCriteria | null) => void;
}) {
  const [tab, setTab] = useState<FavoriteKindTab>("todas");
  const [filterOpen, setFilterOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const titleId = useId();
  const showTabs = propiasCount > 0 && subcontratasCount > 0;
  const activeFilterCount = countActiveFavoriteFilters(appliedCriteria);

  useEffect(() => setMounted(true), []);

  function openFilters() {
    setFormKey((k) => k + 1);
    setFilterOpen(true);
  }

  function closeFilters() {
    setFilterOpen(false);
  }

  function onApply() {
    const form = document.getElementById(
      FAVORITES_FILTER_FORM_ID,
    ) as HTMLFormElement | null;
    if (!form) return;
    const criteria = buildCriteriaFromSearchForm(form);
    onApplyFilters(criteria);
    setFilterOpen(false);
  }

  function onClearFilters() {
    onApplyFilters(null);
    setFormKey((k) => k + 1);
    setFilterOpen(false);
  }

  const filterInitial = appliedCriteria
    ? {
        ...criteriaToFilterInitial(appliedCriteria),
        openForSubmission: Boolean(appliedCriteria.open_for_submission),
      }
    : emptyFavoritesFilterInitial();

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 border-b border-border">
        {showTabs ? (
          <div
            className="flex min-w-0 flex-wrap items-end gap-1"
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
        ) : (
          <div className="min-h-9 min-w-0 flex-1" aria-hidden />
        )}

        <FiltersButton
          activeCount={activeFilterCount}
          onClick={openFilters}
        />
      </div>

      <div className="-mt-px" role={showTabs ? "tabpanel" : undefined}>
        {showTabs
          ? tab === "todas"
            ? todas
            : tab === "propia"
              ? propias
              : subcontratas
          : todas}
      </div>

      {mounted && filterOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-3 sm:p-6"
              role="presentation"
              onClick={closeFilters}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="flex max-h-[min(92vh,48rem)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
                  <h2
                    id={titleId}
                    className="text-lg font-semibold leading-none tracking-tight text-foreground"
                  >
                    Filtrar favoritos
                  </h2>
                  <button
                    type="button"
                    onClick={closeFilters}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-destructive bg-surface text-destructive transition-colors hover:bg-destructive/10"
                    aria-label="Cerrar"
                  >
                    <span aria-hidden className="text-xl leading-none">
                      ×
                    </span>
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                  <form
                    key={formKey}
                    id={FAVORITES_FILTER_FORM_ID}
                    className="space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      onApply();
                    }}
                  >
                    <CriteriaFilters
                      initial={filterInitial}
                      filterOptions={filterOptions}
                      formId={FAVORITES_FILTER_FORM_ID}
                      idPrefix="fav-filter-"
                    />
                  </form>
                </div>

                <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    onClick={onClearFilters}
                    className="px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Limpiar
                  </button>
                  <Button type="button" size="sm" onClick={onApply}>
                    Aplicar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={closeFilters}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}

function FiltersButton({
  activeCount,
  onClick,
}: {
  activeCount: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "mb-px inline-flex shrink-0 items-center gap-2 px-1 py-2",
        "text-base font-medium text-primary-dark",
        "transition-colors hover:text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <FiltersIcon />
      {activeCount > 0 ? `Filtrar(${activeCount})` : "Filtrar"}
    </button>
  );
}

/** Sliders horizontales (estilo outline del shell). */
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
