"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  criteriaEqual,
  criteriaHasFilters,
  formFieldsToCriteria,
  parseCriteria,
} from "@/lib/criteria-display";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  createOwnAlert,
  createOwnSavedSearch,
  listOwnSavedSearches,
  ownAlertNameTaken,
  type DigestFrequency,
} from "@/lib/queries";

export function AlertsPanel({
  userId,
  digestFrequency,
}: {
  userId: string;
  digestFrequency: DigestFrequency;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [cpv, setCpv] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function resetForm() {
    setName("");
    setKeywords("");
    setCpv("");
    setMin("");
    setMax("");
  }

  function buildOrFail() {
    const criteria = formFieldsToCriteria({ keywords, cpv, min, max });
    if (!name.trim()) {
      setError("Indica un nombre.");
      return null;
    }
    if (!criteriaHasFilters(criteria)) {
      setError("Indica al menos un criterio (keywords, CPV o importe).");
      return null;
    }
    const minVal = criteria.estimated_value_min;
    const maxVal = criteria.estimated_value_max;
    if (
      minVal != null &&
      maxVal != null &&
      !Number.isNaN(minVal) &&
      !Number.isNaN(maxVal) &&
      minVal > maxVal
    ) {
      setError("Importe solicitado inválido.");
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
    <form className="mt-8 space-y-4 border-t border-border pt-8">
      <h2 className="text-base font-medium text-foreground">Crear alerta</h2>
      <div>
        <label htmlFor="item_name" className="block text-sm font-medium text-foreground">
          Nombre de la alerta
        </label>
        <Input
          id="item_name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1"
        />
      </div>
      <div>
        <label htmlFor="keywords" className="block text-sm font-medium text-foreground">
          Keywords (separados por comas)
        </label>
        <Input
          id="keywords"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          className="mt-1"
        />
      </div>
      <div>
        <label htmlFor="cpv" className="block text-sm font-medium text-foreground">
          CPV (prefijo)
        </label>
        <Input
          id="cpv"
          value={cpv}
          onChange={(e) => setCpv(e.target.value)}
          className="mt-1 font-mono"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="min" className="block text-sm font-medium text-foreground">
            Importe mín. (sin IVA)
          </label>
          <Input
            id="min"
            type="number"
            min={0}
            step={1}
            value={min}
            onChange={(e) => setMin(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <label htmlFor="max" className="block text-sm font-medium text-foreground">
            Importe máx. (sin IVA)
          </label>
          <Input
            id="max"
            type="number"
            min={0}
            step={1}
            value={max}
            onChange={(e) => setMax(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>
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
