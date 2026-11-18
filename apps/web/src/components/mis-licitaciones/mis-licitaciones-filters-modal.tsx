"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { OFFER_STAGE_LABELS, type OfferStage } from "@/lib/queries";
import { cn } from "@/lib/cn";
import {
  EMPTY_MIS_LICITACIONES_FILTERS,
  stagesForScope,
  type MisLicitacionesFilters,
} from "@/components/mis-licitaciones/mis-licitaciones-filters";

const inputClass =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";

type Props = {
  open: boolean;
  scope: "active" | "historic";
  years: number[];
  ownerOptions: { value: string; label: string }[];
  applied: MisLicitacionesFilters;
  onClose: () => void;
  onApply: (next: MisLicitacionesFilters) => void;
  onClear: () => void;
};

/** Modal de filtros Mis licitaciones (shell como Favoritos/Recomendaciones). */
export function MisLicitacionesFiltersModal({
  open,
  scope,
  years,
  ownerOptions,
  applied,
  onClose,
  onApply,
  onClear,
}: Props) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState<MisLicitacionesFilters>(applied);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setDraft(applied);
    setFormKey((k) => k + 1);
  }, [open, applied]);

  if (!mounted || !open) return null;

  const stageOptions = stagesForScope(scope);

  function toggleStage(stage: OfferStage) {
    setDraft((prev) => {
      const has = prev.stages.includes(stage);
      return {
        ...prev,
        stages: has
          ? prev.stages.filter((s) => s !== stage)
          : [...prev.stages, stage],
      };
    });
  }

  function parseAmount(raw: string): number | null {
    const t = raw.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-3 sm:p-6"
      role="presentation"
      onClick={onClose}
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
            Filtrar Mis licitaciones
          </h2>
          <button
            type="button"
            onClick={onClose}
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
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              onApply(draft);
            }}
          >
            {scope === "historic" ? (
              <div>
                <label
                  htmlFor="ml-filter-year"
                  className="block text-sm font-medium text-foreground"
                >
                  Año
                </label>
                <select
                  id="ml-filter-year"
                  className={inputClass}
                  value={draft.year ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraft((prev) => ({
                      ...prev,
                      year: v ? Number.parseInt(v, 10) : null,
                    }));
                  }}
                >
                  <option value="">Todos</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                El filtro de año solo aplica en Histórico.
              </p>
            )}

            <fieldset>
              <legend className="text-sm font-medium text-foreground">
                Estado
              </legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {stageOptions.map((stage) => (
                  <label
                    key={stage}
                    className="inline-flex items-center gap-2 text-sm text-foreground"
                  >
                    <input
                      type="checkbox"
                      className="ef-checkbox"
                      checked={draft.stages.includes(stage)}
                      onChange={() => toggleStage(stage)}
                    />
                    {OFFER_STAGE_LABELS[stage]}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="ml-filter-min"
                  className="block text-sm font-medium text-foreground"
                >
                  Importe mín. (sin IVA)
                </label>
                <input
                  id="ml-filter-min"
                  type="number"
                  min={0}
                  step={1}
                  className={inputClass}
                  defaultValue={draft.amountMin ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      amountMin: parseAmount(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label
                  htmlFor="ml-filter-max"
                  className="block text-sm font-medium text-foreground"
                >
                  Importe máx. (sin IVA)
                </label>
                <input
                  id="ml-filter-max"
                  type="number"
                  min={0}
                  step={1}
                  className={inputClass}
                  defaultValue={draft.amountMax ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      amountMax: parseAmount(e.target.value),
                    }))
                  }
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="ml-filter-owner"
                className="block text-sm font-medium text-foreground"
              >
                Responsable
              </label>
              <select
                id="ml-filter-owner"
                className={inputClass}
                value={draft.ownerKey}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    ownerKey: e.target.value,
                  }))
                }
              >
                <option value="">Todos</option>
                {ownerOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </form>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={() => {
              setDraft(EMPTY_MIS_LICITACIONES_FILTERS);
              onClear();
            }}
            className="px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Limpiar
          </button>
          <Button
            type="button"
            size="sm"
            onClick={() => onApply(draft)}
          >
            Aplicar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            Cancelar
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function MisLicitacionesFiltersButton({
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
        "inline-flex shrink-0 items-center gap-2 px-1 py-2",
        "text-base font-medium text-primary-dark",
        "transition-colors hover:text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
      aria-label="Filtrar"
    >
      <FiltersIcon />
      {activeCount > 0 ? `Filtrar(${activeCount})` : "Filtrar"}
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
