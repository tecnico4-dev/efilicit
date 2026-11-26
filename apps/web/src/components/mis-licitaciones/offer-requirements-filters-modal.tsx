"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { ENVELOPE_LABELS } from "@/components/mis-licitaciones/offer-case-sections";
import {
  FilterMultiSelect,
  FilterSingleSelect,
} from "@/components/mis-licitaciones/offer-filter-selects";
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
  ([value, label]) => ({
    value,
    label: value === "ninguno" ? "—" : label,
  }),
);

const DUE_OPTIONS = [
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
                allLabel="Todos"
                options={TYPE_OPTIONS}
                selected={draft.types}
                onChange={(types) => setDraft((p) => ({ ...p, types }))}
              />
              <FilterMultiSelect
                id="req-filter-compliance"
                label="¿Cumplimos?"
                allLabel="Todos"
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
                allLabel="Todos"
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
                allLabel="Todos"
                options={ownerOpts}
                selected={draft.owners}
                onChange={(owners) => setDraft((p) => ({ ...p, owners }))}
              />
              <FilterMultiSelect
                id="req-filter-envelope"
                label="Sobre"
                allLabel="Todos"
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
                onChange={(due) =>
                  setDraft((p) => ({
                    ...p,
                    due: due as OfferRequirementsFilters["due"],
                  }))
                }
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
