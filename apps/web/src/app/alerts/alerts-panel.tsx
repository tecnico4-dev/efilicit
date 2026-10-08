"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  criteriaHasFilters,
  formFieldsToCriteria,
} from "@/lib/criteria-display";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  createOwnAlert,
  createOwnSavedSearch,
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
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function resetForm() {
    setName("");
    setKeywords("");
    setCpv("");
  }

  function buildOrFail() {
    const criteria = formFieldsToCriteria({ keywords, cpv });
    if (!name.trim()) {
      setError("Indica un nombre.");
      return null;
    }
    if (!criteriaHasFilters(criteria)) {
      setError("Indica al menos un criterio (keywords o CPV).");
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

  const digestLabel = digestFrequency === "weekly" ? "semanal" : "diaria";

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
      <p className="text-xs text-muted-foreground">
        Digest de la cuenta: {digestLabel}. Cámbialo en{" "}
        <a href="/account" className="font-medium text-link hover:underline">
          Cuenta
        </a>
        .
      </p>
    </form>
  );
}
