"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CriteriaFilters,
  type CriteriaFilterOptionsProp,
} from "@/components/criteria/criteria-filters";
import {
  criteriaHasFilters,
  criteriaToFilterInitial,
  formatCriteriaSummary,
  parseCriteria,
} from "@/lib/criteria-display";
import {
  buildCriteriaFromSearchForm,
  hasInvalidAmountRange,
  hasInvalidPublicationRange,
} from "@/lib/build-criteria-from-form";
import { cn } from "@/lib/cn";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ownAlertNameTaken, updateOwnAlert } from "@/lib/queries";
import type { Database } from "@efilicit/types";
import { AlertRelatedTendersPanel } from "./alert-related-tenders-panel";
import { RemoveAlertButton } from "./remove-alert-button";

type AlertRow = Database["public"]["Tables"]["alerts"]["Row"];

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

/** Interruptor Activa/Inactiva: ancho fijo (Inactiva); círculo pegado al extremo. */
function ActiveToggle({
  active,
  disabled,
  pending,
  onToggle,
}: {
  active: boolean;
  disabled?: boolean;
  pending?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={active ? "Desactivar alerta" : "Activar alerta"}
      title={active ? "Desactivar" : "Activar"}
      disabled={disabled || pending}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-8 w-[5.25rem] shrink-0 items-center rounded-full border transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:opacity-50",
        active
          ? "border-primary/30 bg-primary/15"
          : "border-destructive/25 bg-destructive/15",
      )}
    >
      {/* Etiqueta en el hueco libre (el círculo ocupa ~1.75rem en un extremo). */}
      <span
        className={cn(
          "pointer-events-none absolute inset-y-0 flex items-center justify-center text-[10px] font-semibold leading-none tracking-wide",
          active
            ? "left-1 right-7 text-link"
            : "left-7 right-1 text-destructive",
        )}
        aria-hidden
      >
        {active ? "Activa" : "Inactiva"}
      </span>
      <span
        className={cn(
          "pointer-events-none absolute top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-background shadow-sm transition-[left,right] duration-200",
          active ? "right-0.5 left-auto" : "left-0.5 right-auto",
        )}
      >
        {active ? (
          <svg
            viewBox="0 0 16 16"
            className="size-3.5 text-primary"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 16 16"
            className="size-3.5 text-destructive"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        )}
      </span>
    </button>
  );
}

export function AlertRowItem({
  alert,
  filterOptions,
  hasRelatedTenders = false,
  municipalityNames = {},
}: {
  alert: AlertRow;
  filterOptions: CriteriaFilterOptionsProp;
  /** Hay filas en notification_queue para esta alerta. */
  hasRelatedTenders?: boolean;
  municipalityNames?: Readonly<Record<string, string>>;
}) {
  const router = useRouter();
  const criteria = parseCriteria(alert.criteria);
  const formId = `alert-edit-form-${alert.id}`;
  const idPrefix = `alert-edit-${alert.id}-`;

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(alert.name);
  const [editKey, setEditKey] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [relatedOpen, setRelatedOpen] = useState(false);

  async function toggleActive() {
    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const { error: updateError } = await updateOwnAlert(client, {
      alertId: alert.id,
      isActive: !alert.is_active,
    });
    setPending(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.refresh();
  }

  async function onSaveEdit() {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) {
      setError("No se encontró el formulario.");
      return;
    }
    if (!name.trim()) {
      setError("Indica un nombre.");
      return;
    }
    if (hasInvalidAmountRange(form)) {
      setError("Importe solicitado inválido.");
      return;
    }
    if (hasInvalidPublicationRange(form)) {
      setError("Rango de fechas de publicación inválido.");
      return;
    }
    const nextCriteria = buildCriteriaFromSearchForm(form);
    if (!nextCriteria || !criteriaHasFilters(nextCriteria)) {
      setError("Indica al menos un criterio de búsqueda.");
      return;
    }

    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const nameCheck = await ownAlertNameTaken(client, {
      name: name.trim(),
      excludeAlertId: alert.id,
    });
    if (nameCheck.error) {
      setPending(false);
      setError(nameCheck.error.message);
      return;
    }
    if (nameCheck.taken) {
      setPending(false);
      setError("Ya existe una alerta con este nombre.");
      return;
    }

    const { error: updateError } = await updateOwnAlert(client, {
      alertId: alert.id,
      name: name.trim(),
      criteria: nextCriteria,
    });
    setPending(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  function cancelEdit() {
    setName(alert.name);
    setEditKey((k) => k + 1);
    setError(null);
    setEditing(false);
  }

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{alert.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatCriteriaSummary(criteria, { municipalityNames })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ActiveToggle
              active={alert.is_active}
              disabled={editing}
              pending={pending}
              onToggle={() => void toggleActive()}
            />
            <button
              type="button"
              disabled={pending || editing}
              aria-pressed={editing}
              aria-label="Editar alerta"
              title="Editar"
              onClick={() => {
                setEditing(true);
                setEditKey((k) => k + 1);
                setError(null);
              }}
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-md text-foreground/75 transition-colors",
                "hover:bg-muted hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                "disabled:pointer-events-none disabled:opacity-50",
                editing && "bg-muted text-foreground",
              )}
            >
              <PencilIcon className="size-[1.15rem]" />
            </button>
            <RemoveAlertButton alert={alert} disabled={editing} />
          </div>
          {hasRelatedTenders ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || editing}
              onClick={() => setRelatedOpen(true)}
            >
              Licitaciones relacionadas
            </Button>
          ) : null}
        </div>
      </div>

      <AlertRelatedTendersPanel
        alertId={alert.id}
        alertName={alert.name}
        userId={alert.user_id}
        open={relatedOpen}
        onClose={() => setRelatedOpen(false)}
      />

      {editing ? (
        <form
          id={formId}
          className="mt-4 space-y-3 rounded-lg border border-border bg-surface p-4"
          onSubmit={(e) => e.preventDefault()}
        >
          <div>
            <label
              htmlFor={`${idPrefix}name`}
              className="block text-sm font-medium text-primary"
            >
              Nombre de la alerta*
            </label>
            <Input
              id={`${idPrefix}name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 border-primary/25 bg-primary-light/45"
            />
          </div>
          {/* Hueco bajo el textbox del nombre → label «Texto» (filtros). */}
          <div className="!mt-8">
            <CriteriaFilters
              key={editKey}
              initial={criteriaToFilterInitial(criteria)}
              filterOptions={filterOptions}
              formId={formId}
              idPrefix={idPrefix}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={onSaveEdit}
            >
              Guardar cambios
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={cancelEdit}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}
