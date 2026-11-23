"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnchoredPortal } from "@/components/ui/anchored-portal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { ENVELOPE_LABELS } from "@/components/mis-licitaciones/offer-case-sections";
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
];

const ENVELOPE_OPTIONS = Object.entries(ENVELOPE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const DUE_OPTIONS: { value: OfferRequirementsFilters["due"]; label: string }[] =
  [
    { value: "", label: "Todas" },
    { value: "con", label: "Con fecha" },
    { value: "sin", label: "Sin fecha" },
    { value: "vencida", label: "Vencida" },
  ];

type Props = {
  open: boolean;
  ownerOptions: { value: string; label: string }[];
  applied: OfferRequirementsFilters;
  onClose: () => void;
  onApply: (next: OfferRequirementsFilters) => void;
  onClear: () => void;
};

/** Modal de filtros Requisitos — campos estilo Crear alerta / Criteria. */
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
  const [formKey, setFormKey] = useState(0);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setDraft(applied);
    setFormKey((k) => k + 1);
  }, [open, applied]);

  if (!mounted || !open) return null;

  const ownerOpts = [
    { value: OWNER_UNASSIGNED, label: "Sin asignar" },
    ...ownerOptions,
  ];

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
            Filtrar requisitos
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-destructive bg-surface text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label="Cerrar"
          >
            <span aria-hidden className="text-xl leading-none">
              ×
            </span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <div key={formKey} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <FilterMultiSelect
                id="req-filter-type"
                label="Tipo"
                options={TYPE_OPTIONS}
                selected={draft.types}
                onChange={(types) => setDraft((p) => ({ ...p, types }))}
              />
              <FilterMultiSelect
                id="req-filter-compliance"
                label="¿Cumplimos?"
                options={OFFER_COMPLIANCE_STATUSES.map((s) => ({
                  value: s,
                  label: OFFER_COMPLIANCE_LABELS[s],
                }))}
                selected={draft.compliance}
                onChange={(compliance) =>
                  setDraft((p) => ({ ...p, compliance }))
                }
              />
              <FilterMultiSelect
                id="req-filter-prep"
                label="Preparación"
                options={OFFER_PREP_STATUSES.map((s) => ({
                  value: s,
                  label: OFFER_PREP_LABELS[s],
                }))}
                selected={draft.prep}
                onChange={(prep) => setDraft((p) => ({ ...p, prep }))}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FilterMultiSelect
                id="req-filter-owner"
                label="Responsable"
                options={ownerOpts}
                selected={draft.owners}
                onChange={(owners) => setDraft((p) => ({ ...p, owners }))}
              />
              <FilterMultiSelect
                id="req-filter-envelope"
                label="Sobre"
                options={ENVELOPE_OPTIONS}
                selected={draft.envelopes}
                onChange={(envelopes) =>
                  setDraft((p) => ({ ...p, envelopes }))
                }
              />
              <FilterSingleSelect
                id="req-filter-due"
                label="Fecha interna"
                options={DUE_OPTIONS}
                value={draft.due}
                onChange={(due) => setDraft((p) => ({ ...p, due }))}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">
          <Button type="button" onClick={() => onApply(draft)}>
            Aplicar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraft(EMPTY_OFFER_REQUIREMENTS_FILTERS);
              onClear();
            }}
          >
            Limpiar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            Cancelar
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Desplegable multi-valor (estilo CriteriaMultiSelect).
 * `selected` vacío en el padre = «Todos» (sin filtrar).
 * «Limpiar» vacía casillas; si cierras con 0 ticks, se restaura lo anterior.
 */
function FilterMultiSelect({
  id,
  label,
  options,
  selected,
  onChange,
  allLabel = "Todos",
}: {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  allLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const allValues = useMemo(() => options.map((o) => o.value), [options]);
  const labelByValue = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of options) m.set(o.value, o.label);
    return m;
  }, [options]);

  /** Selección en UI mientras el menú está abierto (puede ser []). */
  const [draft, setDraft] = useState<string[]>([]);

  function toUiSelection(values: string[]): string[] {
    return values.length === 0 ? [...allValues] : [...values];
  }

  function commitFromUi(ui: string[]) {
    if (ui.length === 0 || ui.length === allValues.length) {
      onChange([]);
      return;
    }
    onChange(ui);
  }

  function openMenu() {
    setDraft(toUiSelection(selected));
    setOpen(true);
  }

  function closeMenu() {
    // Limpiar + cerrar (0 casillas) → se mantiene lo que había en el modal.
    if (draft.length > 0) {
      commitFromUi(draft);
    }
    setOpen(false);
  }

  const isAll = open
    ? draft.length === allValues.length && allValues.length > 0
    : selected.length === 0;
  const uiSelected = open ? draft : toUiSelection(selected);

  const summary =
    selected.length === 0
      ? allLabel
      : selected.length <= 2
        ? selected.map((v) => labelByValue.get(v) ?? v).join(", ")
        : `${selected.length} seleccionados`;

  function toggle(value: string) {
    setDraft((prev) => {
      if (prev.includes(value)) return prev.filter((v) => v !== value);
      return [...prev, value];
    });
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative mt-1">
        <button
          ref={triggerRef}
          type="button"
          id={id}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => (open ? closeMenu() : openMenu())}
          className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-left text-sm text-foreground outline-none hover:bg-muted/40 focus:ring-2 focus:ring-ring"
        >
          <span className="min-w-0 truncate">{summary}</span>
          <span aria-hidden className="shrink-0 text-xs text-muted-foreground">
            ▾
          </span>
        </button>
        <AnchoredPortal
          open={open}
          anchorRef={triggerRef}
          onDismiss={closeMenu}
          className="flex flex-col overflow-hidden bg-surface p-0"
          maxHeight={224}
          overflowY="hidden"
        >
          <div className="flex shrink-0 border-b border-border bg-surface">
            <button
              type="button"
              className={cn(
                "flex-1 px-3 py-1.5 text-left text-xs font-medium transition-colors",
                isAll
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              onClick={() => setDraft([...allValues])}
            >
              {allLabel}
            </button>
            <button
              type="button"
              className="flex-1 border-l border-border px-3 py-1.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => setDraft([])}
            >
              Limpiar
            </button>
          </div>
          <ul
            role="listbox"
            aria-multiselectable
            className="min-h-0 flex-1 overflow-y-auto py-1"
          >
            {options.map((opt) => {
              const checked = uiSelected.includes(opt.value);
              return (
                <li key={opt.value} role="option" aria-selected={checked}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted">
                    <input
                      type="checkbox"
                      className="ef-checkbox"
                      checked={checked}
                      onChange={() => toggle(opt.value)}
                    />
                    <span className="min-w-0 truncate">{opt.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </AnchoredPortal>
      </div>
    </div>
  );
}

function FilterSingleSelect({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  options: { value: OfferRequirementsFilters["due"]; label: string }[];
  value: OfferRequirementsFilters["due"];
  onChange: (next: OfferRequirementsFilters["due"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const summary =
    options.find((o) => o.value === value)?.label ?? "Todas";

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative mt-1">
        <button
          ref={triggerRef}
          type="button"
          id={id}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-left text-sm text-foreground outline-none hover:bg-muted/40 focus:ring-2 focus:ring-ring"
        >
          <span className="min-w-0 truncate">{summary}</span>
          <span aria-hidden className="shrink-0 text-xs text-muted-foreground">
            ▾
          </span>
        </button>
        <AnchoredPortal
          open={open}
          anchorRef={triggerRef}
          onDismiss={() => setOpen(false)}
          className="bg-surface p-1"
          maxHeight={220}
        >
          <ul role="listbox" className="py-0.5">
            {options.map((opt) => (
              <li key={opt.value || "all"}>
                <button
                  type="button"
                  role="option"
                  aria-selected={opt.value === value}
                  className={cn(
                    "flex w-full rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-muted",
                    opt.value === value
                      ? "font-semibold text-foreground"
                      : "text-foreground",
                  )}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>
        </AnchoredPortal>
      </div>
    </div>
  );
}
