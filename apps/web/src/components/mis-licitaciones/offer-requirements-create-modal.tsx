"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState } from "react";
import { AnchoredPortal } from "@/components/ui/anchored-portal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  ENVELOPE_LABELS,
  REQUIREMENT_CATEGORY_LABELS,
} from "@/components/mis-licitaciones/offer-case-sections";
import { SingleDatePicker } from "@/components/mis-licitaciones/single-date-picker";
import {
  OFFER_COMPLIANCE_LABELS,
  OFFER_COMPLIANCE_STATUSES,
  OFFER_ENVELOPES,
  OFFER_PREP_LABELS,
  OFFER_PREP_STATUSES,
  OFFER_REQUIREMENT_TYPES,
  type EficenMemberForTeam,
  type OfferComplianceStatus,
  type OfferEnvelope,
  type OfferPrepStatus,
  type OfferRequirementType,
} from "@/lib/queries";

export type OfferRequirementCreateValues = {
  title: string;
  requirement_type: OfferRequirementType | "";
  category: string;
  envelope: OfferEnvelope;
  compliance_status: OfferComplianceStatus;
  prep_status: OfferPrepStatus;
  owner_member_id: string | null;
  internal_due_at: string | null;
  required_value: string;
};

export const EMPTY_REQUIREMENT_CREATE: OfferRequirementCreateValues = {
  title: "",
  requirement_type: "",
  category: "",
  envelope: "ninguno",
  compliance_status: "sin_verificar",
  prep_status: "pendiente",
  owner_member_id: null,
  internal_due_at: null,
  required_value: "",
};

const TYPE_OPTIONS = OFFER_REQUIREMENT_TYPES.map((value) => ({
  value,
  label:
    value === "excluyente"
      ? "Excluyente"
      : value === "puntuable"
        ? "Puntuable"
        : "Informativo",
}));

const CATEGORY_OPTIONS = Object.entries(REQUIREMENT_CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const ENVELOPE_OPTIONS = OFFER_ENVELOPES.map((value) => ({
  value,
  label: value === "ninguno" ? "Sin sobre" : (ENVELOPE_LABELS[value] ?? value),
}));

/** Cáscara compartida: altura fija para que input y desplegable midan igual. */
const fieldControlClass =
  "box-border flex h-9 w-full items-center rounded-md border border-border bg-background px-3 text-left text-sm leading-none text-foreground outline-none hover:bg-muted/40 focus:ring-2 focus:ring-ring disabled:opacity-50";

const fieldLabelRowClass =
  "flex h-5 items-center gap-1.5 text-sm font-medium text-foreground";

const inputClass = cn(fieldControlClass, "mt-1");

type Props = {
  open: boolean;
  busy?: boolean;
  members: EficenMemberForTeam[];
  onClose: () => void;
  onSubmit: (values: OfferRequirementCreateValues) => void | Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
};

function isCreateDirty(d: OfferRequirementCreateValues): boolean {
  return (
    d.title.trim() !== "" ||
    d.requirement_type !== "" ||
    d.category !== "" ||
    d.envelope !== EMPTY_REQUIREMENT_CREATE.envelope ||
    d.compliance_status !== EMPTY_REQUIREMENT_CREATE.compliance_status ||
    d.prep_status !== EMPTY_REQUIREMENT_CREATE.prep_status ||
    d.owner_member_id != null ||
    d.internal_due_at != null ||
    d.required_value.trim() !== ""
  );
}

/** Modal de alta de requisito (shell como filtros / Crear alerta). */
export function OfferRequirementsCreateModal({
  open,
  busy,
  members,
  onClose,
  onSubmit,
  onDirtyChange,
}: Props) {
  const titleId = useId();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState<OfferRequirementCreateValues>(
    EMPTY_REQUIREMENT_CREATE,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setDraft(EMPTY_REQUIREMENT_CREATE);
    setFormError(null);
    setFormKey((k) => k + 1);
    onDirtyChange?.(false);
    const t = window.setTimeout(() => titleInputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open, onDirtyChange]);

  useEffect(() => {
    if (!open) {
      onDirtyChange?.(false);
      return;
    }
    onDirtyChange?.(isCreateDirty(draft));
  }, [open, draft, onDirtyChange]);

  if (!mounted || !open) return null;

  const canSubmit =
    draft.title.trim().length > 0 &&
    draft.requirement_type !== "" &&
    draft.category !== "";

  async function handleSubmit() {
    if (!draft.title.trim()) {
      setFormError("El título es obligatorio.");
      titleInputRef.current?.focus();
      return;
    }
    if (!draft.requirement_type) {
      setFormError("El tipo es obligatorio.");
      return;
    }
    if (!draft.category) {
      setFormError("La categoría es obligatoria.");
      return;
    }
    setFormError(null);
    let next = draft;
    if (draft.compliance_status === "cumple") {
      next = { ...draft, prep_status: "listo" };
    }
    await onSubmit(next);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-3 sm:p-6"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[min(92vh,48rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <h2
            id={titleId}
            className="text-lg font-semibold leading-none tracking-tight text-foreground"
          >
            Crear requisito
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-destructive bg-surface text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            aria-label="Cerrar"
          >
            <span aria-hidden className="text-xl leading-none">
              ×
            </span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <div key={formKey} className="space-y-4">
            <div>
              <label
                htmlFor="req-create-title"
                className="block text-sm font-medium text-foreground"
              >
                Título<span className="text-destructive">*</span>
              </label>
              <input
                ref={titleInputRef}
                id="req-create-title"
                value={draft.title}
                disabled={busy}
                className={cn(
                  inputClass,
                  "border-primary/25 bg-primary-light/45 shadow-sm",
                )}
                placeholder="Nombre del requisito"
                onChange={(e) =>
                  setDraft((d) => ({ ...d, title: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleSubmit();
                  }
                }}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <SingleSelect
                id="req-create-type"
                label="Tipo"
                required
                disabled={busy}
                placeholder="Seleccionar"
                options={TYPE_OPTIONS}
                value={draft.requirement_type}
                onChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    requirement_type: v as OfferRequirementType,
                  }))
                }
              />
              <SingleSelect
                id="req-create-category"
                label="Categoría"
                required
                disabled={busy}
                placeholder="Seleccionar"
                options={CATEGORY_OPTIONS}
                value={draft.category}
                onChange={(v) => setDraft((d) => ({ ...d, category: v }))}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <SingleSelect
                id="req-create-envelope"
                label="Sobre"
                disabled={busy}
                options={ENVELOPE_OPTIONS}
                value={draft.envelope}
                mutedValues={["ninguno"]}
                onChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    envelope: v as OfferEnvelope,
                  }))
                }
              />
              <div>
                <div className={fieldLabelRowClass}>
                  <label htmlFor="req-create-required-value">
                    Valor requerido
                  </label>
                  <ClickHint tip="Ejemplos: cifra, umbral o texto del pliego." />
                </div>
                <div className="relative mt-1">
                  <div
                    className={cn(
                      fieldControlClass,
                      "focus-within:ring-2 focus-within:ring-ring",
                    )}
                  >
                    <input
                      id="req-create-required-value"
                      value={draft.required_value}
                      disabled={busy}
                      className="h-full min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-sm leading-none text-foreground outline-none disabled:opacity-50"
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          required_value: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <SingleSelect
                id="req-create-compliance"
                label="¿Cumplimos?"
                disabled={busy}
                options={OFFER_COMPLIANCE_STATUSES.map((s) => ({
                  value: s,
                  label: OFFER_COMPLIANCE_LABELS[s],
                }))}
                value={draft.compliance_status}
                onChange={(v) => {
                  const compliance = v as OfferComplianceStatus;
                  setDraft((d) => ({
                    ...d,
                    compliance_status: compliance,
                    ...(compliance === "cumple"
                      ? { prep_status: "listo" as const }
                      : {}),
                  }));
                }}
              />
              <SingleSelect
                id="req-create-prep"
                label="Preparación"
                disabled={busy || draft.compliance_status === "no_aplica"}
                options={OFFER_PREP_STATUSES.map((s) => ({
                  value: s,
                  label: OFFER_PREP_LABELS[s],
                }))}
                value={draft.prep_status}
                onChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    prep_status: v as OfferPrepStatus,
                  }))
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <SingleSelect
                id="req-create-owner"
                label="Responsable"
                disabled={busy}
                options={[
                  { value: "", label: "Sin asignar" },
                  ...members.map((m) => ({
                    value: m.id,
                    label: m.displayName,
                  })),
                ]}
                value={draft.owner_member_id ?? ""}
                onChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    owner_member_id: v || null,
                  }))
                }
              />
              <div>
                <p className="block text-sm font-medium text-foreground">
                  Fecha interna
                </p>
                <SingleDatePicker
                  value={
                    draft.internal_due_at
                      ? draft.internal_due_at.slice(0, 10)
                      : null
                  }
                  disabled={busy}
                  boxed
                  placeholder="Elegir fecha"
                  onChange={(day) =>
                    setDraft((d) => ({
                      ...d,
                      internal_due_at: day ? `${day}T12:00:00.000Z` : null,
                    }))
                  }
                />
              </div>
            </div>

            {formError ? (
              <p className="text-sm text-destructive" role="alert">
                {formError}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">
          <Button
            type="button"
            disabled={busy || !canSubmit}
            onClick={() => void handleSubmit()}
          >
            Crear
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
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

function ClickHint({ tip }: { tip: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={tip}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-full border border-muted-foreground/50 text-[0.625rem] font-semibold leading-none text-muted-foreground hover:border-foreground hover:text-foreground"
      >
        i
      </button>
      {open ? (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-10 mb-1.5 w-max max-w-[14rem] -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-center text-xs font-normal text-background shadow-sm"
        >
          {tip}
        </span>
      ) : null}
    </span>
  );
}

function SingleSelect({
  id,
  label,
  required,
  options,
  value,
  disabled,
  placeholder = "Seleccionar",
  mutedValues = [""],
  onChange,
}: {
  id: string;
  label: string;
  required?: boolean;
  options: { value: string; label: string }[];
  value: string;
  disabled?: boolean;
  placeholder?: string;
  /** Valores que se muestran en gris (p. ej. «Sin sobre»). */
  mutedValues?: string[];
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((o) => o.value === value);
  const empty = mutedValues.includes(value);
  const summary = selected?.label ?? placeholder;

  return (
    <div>
      <div className={fieldLabelRowClass}>
        <label htmlFor={id}>
          {label}
          {required ? <span className="text-destructive">*</span> : null}
        </label>
      </div>
      <div className="relative mt-1">
        <button
          ref={triggerRef}
          type="button"
          id={id}
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => !disabled && setOpen((v) => !v)}
          className={cn(fieldControlClass, "justify-between gap-2")}
        >
          <span
            className={cn(
              "min-w-0 truncate",
              empty ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {summary}
          </span>
          <span aria-hidden className="shrink-0 text-xs text-muted-foreground">
            ▾
          </span>
        </button>
        <AnchoredPortal
          open={open && !disabled}
          anchorRef={triggerRef}
          onDismiss={() => setOpen(false)}
          className="bg-surface p-1"
          maxHeight={240}
        >
          <ul role="listbox" className="py-0.5">
            {options.map((opt) => (
              <li key={opt.value || "__empty"}>
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
