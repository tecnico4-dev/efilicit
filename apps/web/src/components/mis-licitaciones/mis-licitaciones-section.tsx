"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { OfferCaseListItem } from "@/lib/queries";
import { cn } from "@/lib/cn";
import {
  PipelineBoard,
  type PipelineViewMode,
} from "@/components/mis-licitaciones/pipeline-board";

type Scope = "active" | "historic";

/** Pestañas Activas/Histórico + Lista|Kanban (patrón Recomendaciones / FavoriteKindTabs). */
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
      {/* Una sola fila: pestañas a la izquierda, Lista|Kanban a la derecha (sin wrap). */}
      <div className="flex min-h-10 items-end gap-3 border-b border-border">
        <div
          className="flex min-w-0 flex-1 items-end gap-1"
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
            <div className="hidden max-w-[14rem] flex-wrap justify-end gap-1.5 sm:flex">
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
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      <div className="-mt-px">
        {cases.length === 0 ? empty : (
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

function ViewToggle({
  view,
  onChange,
}: {
  view: PipelineViewMode;
  onChange: (next: PipelineViewMode) => void;
}) {
  return (
    <div
      className="inline-flex overflow-hidden rounded-md border border-border bg-background"
      role="group"
      aria-label="Vista del listado"
    >
      <button
        type="button"
        onClick={() => onChange("lista")}
        className={cn(
          "px-3 py-1.5 text-sm font-medium transition-colors",
          view === "lista"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        Lista
      </button>
      <button
        type="button"
        onClick={() => onChange("kanban")}
        className={cn(
          "px-3 py-1.5 text-sm font-medium transition-colors",
          view === "kanban"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        Kanban
      </button>
    </div>
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
