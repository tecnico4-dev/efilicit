"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  criteriaHasFilters,
  criteriaToFormFields,
  formFieldsToCriteria,
  formatCriteriaSummary,
  parseCriteria,
} from "@/lib/criteria-display";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ownAlertNameTaken, updateOwnAlert } from "@/lib/queries";
import type { Database } from "@efilicit/types";
import { RemoveAlertButton } from "./remove-alert-button";

type AlertRow = Database["public"]["Tables"]["alerts"]["Row"];

export function AlertRowItem({ alert }: { alert: AlertRow }) {
  const router = useRouter();
  const criteria = parseCriteria(alert.criteria);
  const fields = criteriaToFormFields(criteria);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(alert.name);
  const [keywords, setKeywords] = useState(fields.keywords);
  const [cpv, setCpv] = useState(fields.cpv);
  const [min, setMin] = useState(fields.min);
  const [max, setMax] = useState(fields.max);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const nextCriteria = formFieldsToCriteria({ keywords, cpv, min, max });
    if (!name.trim()) {
      setError("Indica un nombre.");
      return;
    }
    if (!criteriaHasFilters(nextCriteria)) {
      setError("Indica al menos un criterio (keywords, CPV o importe).");
      return;
    }
    const minVal = nextCriteria.estimated_value_min;
    const maxVal = nextCriteria.estimated_value_max;
    if (
      minVal != null &&
      maxVal != null &&
      !Number.isNaN(minVal) &&
      !Number.isNaN(maxVal) &&
      minVal > maxVal
    ) {
      setError("Importe solicitado inválido.");
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || editing}
            aria-pressed={editing}
            onClick={() => {
              setEditing(true);
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

      {editing ? (
        <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface p-4">
          <div>
            <label
              htmlFor={`edit-name-${alert.id}`}
              className="block text-sm font-medium text-foreground"
            >
              Nombre de la alerta
            </label>
            <Input
              id={`edit-name-${alert.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label
              htmlFor={`edit-kw-${alert.id}`}
              className="block text-sm font-medium text-foreground"
            >
              Keywords (separados por comas)
            </label>
            <Input
              id={`edit-kw-${alert.id}`}
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label
              htmlFor={`edit-cpv-${alert.id}`}
              className="block text-sm font-medium text-foreground"
            >
              CPV (prefijo)
            </label>
            <Input
              id={`edit-cpv-${alert.id}`}
              value={cpv}
              onChange={(e) => setCpv(e.target.value)}
              className="mt-1 font-mono"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor={`edit-min-${alert.id}`}
                className="block text-sm font-medium text-foreground"
              >
                Importe mín.
              </label>
              <Input
                id={`edit-min-${alert.id}`}
                type="number"
                min={0}
                step={1}
                value={min}
                onChange={(e) => setMin(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label
                htmlFor={`edit-max-${alert.id}`}
                className="block text-sm font-medium text-foreground"
              >
                Importe máx.
              </label>
              <Input
                id={`edit-max-${alert.id}`}
                type="number"
                min={0}
                step={1}
                value={max}
                onChange={(e) => setMax(e.target.value)}
                className="mt-1"
              />
            </div>
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
              onClick={() => {
                setName(alert.name);
                setKeywords(fields.keywords);
                setCpv(fields.cpv);
                setMin(fields.min);
                setMax(fields.max);
                setError(null);
                setEditing(false);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}
