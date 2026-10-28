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
  criteriaEqual,
  criteriaHasFilters,
  emptyCriteriaFilterInitial,
  parseCriteria,
} from "@/lib/criteria-display";
import {
  buildCriteriaFromSearchForm,
  hasInvalidAmountRange,
  hasInvalidPublicationRange,
} from "@/lib/build-criteria-from-form";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  createOwnAlert,
  createOwnSavedSearch,
  listOwnSavedSearches,
  ownAlertNameTaken,
  type DigestFrequency,
} from "@/lib/queries";

export const ALERT_CREATE_FORM_ID = "alert-create-form";

export function AlertsPanel({
  userId,
  digestFrequency,
  filterOptions,
}: {
  userId: string;
  digestFrequency: DigestFrequency;
  filterOptions: CriteriaFilterOptionsProp;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [formKey, setFormKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function resetForm() {
    setName("");
    setFormKey((k) => k + 1);
  }

  function buildOrFail() {
    const form = document.getElementById(
      ALERT_CREATE_FORM_ID,
    ) as HTMLFormElement | null;
    if (!form) {
      setError("No se encontró el formulario.");
      return null;
    }
    if (!name.trim()) {
      setError("Indica un nombre.");
      return null;
    }
    if (hasInvalidAmountRange(form)) {
      setError("Importe solicitado inválido.");
      return null;
    }
    if (hasInvalidPublicationRange(form)) {
      setError("Rango de fechas de publicación inválido.");
      return null;
    }
    const criteria = buildCriteriaFromSearchForm(form);
    if (!criteria || !criteriaHasFilters(criteria)) {
      setError("Indica al menos un criterio de búsqueda.");
      return null;
    }
    return { name: name.trim(), criteria };
  }

  async function onCreateAlert() {
    setError(null);
    const built = buildOrFail();
    if (!built) return;

    setPending(true);
    const client = createSupabaseBrowserClient();
    const nameCheck = await ownAlertNameTaken(client, { name: built.name });
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

    const { error: createError } = await createOwnAlert(client, {
      userId,
      name: built.name,
      criteria: built.criteria,
      frequency: digestFrequency,
    });
    setPending(false);
    if (createError) {
      setError(createError.message);
      return;
    }
    resetForm();
    router.refresh();
  }

  async function onCreateSavedSearch() {
    setError(null);
    const built = buildOrFail();
    if (!built) return;

    setPending(true);
    const client = createSupabaseBrowserClient();
    const existing = await listOwnSavedSearches(client);
    if (existing.error) {
      setPending(false);
      setError(existing.error.message);
      return;
    }
    if (
      existing.data.some((s) =>
        criteriaEqual(built.criteria, parseCriteria(s.criteria)),
      )
    ) {
      setPending(false);
      setError("Ya tienes una búsqueda guardada con esos mismos parámetros.");
      return;
    }

    const { error: createError } = await createOwnSavedSearch(client, {
      userId,
      name: built.name,
      criteria: built.criteria,
    });
    setPending(false);
    if (createError) {
      setError(createError.message);
      return;
    }
    resetForm();
    router.refresh();
  }

  return (
    <form
      id={ALERT_CREATE_FORM_ID}
      className="mt-8 space-y-4 border-t border-border pt-8"
      onSubmit={(e) => e.preventDefault()}
    >
      <h2 className="text-base font-medium text-foreground">Crear alerta</h2>
      <div>
        <label
          htmlFor="item_name"
          className="block text-sm font-medium text-foreground"
        >
          Nombre de la alerta
        </label>
        <Input
          id="item_name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1"
        />
      </div>
      <CriteriaFilters
        key={formKey}
        initial={emptyCriteriaFilterInitial()}
        filterOptions={filterOptions}
        formId={ALERT_CREATE_FORM_ID}
        idPrefix="alert-create-"
      />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={onCreateAlert}>
          Crear alerta
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onCreateSavedSearch}
        >
          Guardar búsqueda
        </Button>
      </div>
    </form>
  );
}
