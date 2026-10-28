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
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ownAlertNameTaken, updateOwnAlert } from "@/lib/queries";
import type { Database } from "@efilicit/types";
import { AlertRelatedTendersPanel } from "./alert-related-tenders-panel";
import { RemoveAlertButton } from "./remove-alert-button";

type AlertRow = Database["public"]["Tables"]["alerts"]["Row"];

export function AlertRowItem({
  alert,
  filterOptions,
  hasRelatedTenders = false,
}: {
  alert: AlertRow;
  filterOptions: CriteriaFilterOptionsProp;
  /** Hay filas en notification_queue para esta alerta. */
  hasRelatedTenders?: boolean;
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
            {formatCriteriaSummary(criteria)}
          </p>
          <p className="mt-2">
            {alert.is_active ? (
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-link">
                Activa
              </span>
            ) : (
              <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                Inactiva
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || editing}
            aria-pressed={editing}
            onClick={() => {
              setEditing(true);
              setEditKey((k) => k + 1);
              setError(null);
            }}
          >
            Editar
          </Button>
          <Button
            type="button"
            variant={alert.is_active ? "outline" : "primary"}
            size="sm"
            disabled={pending || editing}
            onClick={toggleActive}
          >
            {alert.is_active ? "Desactivar" : "Activar"}
          </Button>
          <RemoveAlertButton alert={alert} disabled={editing} />
        </div>
      </div>

      <AlertRelatedTendersPanel
        alertId={alert.id}
        alertName={alert.name}
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
              className="block text-sm font-medium text-foreground"
            >
              Nombre de la alerta
            </label>
            <Input
              id={`${idPrefix}name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
            />
          </div>
          <CriteriaFilters
            key={editKey}
            initial={criteriaToFilterInitial(criteria)}
            filterOptions={filterOptions}
            formId={formId}
            idPrefix={idPrefix}
          />
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
