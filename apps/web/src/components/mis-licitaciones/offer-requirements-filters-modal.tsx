"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  ENVELOPE_LABELS,
} from "@/components/mis-licitaciones/offer-case-sections";
import {
  OFFER_COMPLIANCE_LABELS,
  OFFER_COMPLIANCE_STATUSES,
  OFFER_PREP_LABELS,
  OFFER_PREP_STATUSES,
} from "@/lib/queries";

export const OWNER_UNASSIGNED = "__none__";

export type OfferRequirementsFilters = {
  types: string[];
  compliance: string[];
  prep: string[];
  owners: string[];
  envelopes: string[];
  /** "" = todas · con · sin · vencida */
  due: "" | "con" | "sin" | "vencida";
};

export const EMPTY_OFFER_REQUIREMENTS_FILTERS: OfferRequirementsFilters = {
  types: [],
  compliance: [],
  prep: [],
  owners: [],
  envelopes: [],
  due: "",
};

export function countOfferRequirementsFilters(
  f: OfferRequirementsFilters,
): number {
  return (
    (f.types.length > 0 ? 1 : 0) +
    (f.compliance.length > 0 ? 1 : 0) +
    (f.prep.length > 0 ? 1 : 0) +
    (f.owners.length > 0 ? 1 : 0) +
    (f.envelopes.length > 0 ? 1 : 0) +
    (f.due ? 1 : 0)
  );
}

const TYPE_OPTIONS = [
  { value: "excluyente", label: "Excluyente" },
  { value: "puntuable", label: "Puntuable" },
  { value: "informativo", label: "Informativo" },
] as const;

const ENVELOPE_OPTIONS = Object.entries(ENVELOPE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

type Props = {
  open: boolean;
  ownerOptions: { value: string; label: string }[];
  applied: OfferRequirementsFilters;
  onClose: () => void;
  onApply: (next: OfferRequirementsFilters) => void;
  onClear: () => void;
};

/** Modal de filtros de la pestaña Requisitos (shell como Mis licitaciones). */
export function OfferRequirementsFiltersModal({
  open,
  ownerOptions,
  applied,
  onClose,
  onApply,
  onClear,
}: Props) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState<OfferRequirementsFilters>(applied);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setDraft(applied);
  }, [open, applied]);

  if (!mounted || !open) return null;

  function toggle(
    key: keyof Pick<
      OfferRequirementsFilters,
      "types" | "compliance" | "prep" | "owners" | "envelopes"
    >,
    value: string,
  ) {
    setDraft((prev) => {
      const has = prev[key].includes(value);
      return {
        ...prev,
        [key]: has
          ? prev[key].filter((v) => v !== value)
          : [...prev[key], value],
      };
    });
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
        className="flex max-h-[min(92vh,48rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <h2
            id={titleId}
            className="text-lg font-semibold leading-none tracking-tight text-foreground"
          >
            Filtrar requisitos
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
          <div className="grid gap-5 sm:grid-cols-2">
            <MultiCheck
              label="Tipo"
              options={[...TYPE_OPTIONS]}
              selected={draft.types}
              onToggle={(v) => toggle("types", v)}
            />
            <MultiCheck
              label="¿Cumplimos?"
              options={OFFER_COMPLIANCE_STATUSES.map((s) => ({
                value: s,
                label: OFFER_COMPLIANCE_LABELS[s],
              }))}
              selected={draft.compliance}
              onToggle={(v) => toggle("compliance", v)}
            />
            <MultiCheck
              label="Preparación"
              options={OFFER_PREP_STATUSES.map((s) => ({
                value: s,
                label: OFFER_PREP_LABELS[s],
              }))}
              selected={draft.prep}
              onToggle={(v) => toggle("prep", v)}
            />
            <MultiCheck
              label="Responsable"
              options={[
                { value: OWNER_UNASSIGNED, label: "Sin asignar" },
                ...ownerOptions,
              ]}
              selected={draft.owners}
              onToggle={(v) => toggle("owners", v)}
            />
            <MultiCheck
              label="Sobre"
              options={ENVELOPE_OPTIONS}
              selected={draft.envelopes}
              onToggle={(v) => toggle("envelopes", v)}
            />
            <div>
              <p className="text-sm font-medium text-foreground">
                Fecha interna
              </p>
              <div className="mt-2 space-y-1.5">
                {(
                  [
                    { value: "", label: "Todas" },
                    { value: "con", label: "Con fecha" },
                    { value: "sin", label: "Sin fecha" },
                    { value: "vencida", label: "Vencida" },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.value || "all"}
                    className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
                  >
                    <input
                      type="radio"
                      name="req-due-filter"
                      checked={draft.due === opt.value}
                      onChange={() =>
                        setDraft((prev) => ({ ...prev, due: opt.value }))
                      }
                      className="size-3.5 accent-primary"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={() => {
              setDraft(EMPTY_OFFER_REQUIREMENTS_FILTERS);
              onClear();
            }}
            className="px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Limpiar
          </button>
          <Button type="button" size="sm" onClick={() => onApply(draft)}>
            Aplicar
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function MultiCheck({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {selected.length === 0
          ? "Todos"
          : `${selected.length} seleccionados`}
      </p>
      <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-md border border-border bg-background p-2">
        {options.map((opt) => {
          const checked = selected.includes(opt.value);
          return (
            <li key={opt.value}>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted",
                  checked ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(opt.value)}
                  className="size-3.5 accent-primary"
                />
                <span className="truncate">{opt.label}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
