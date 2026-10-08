"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  createOwnAlert,
  createOwnSavedSearch,
  type DigestFrequency,
} from "@/lib/queries";
import type { SearchCriteria } from "@efilicit/types";

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

  function buildCriteria(): SearchCriteria {
    const kw = keywords
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      version: 1,
      keywords: kw.length ? kw : undefined,
      cpv_codes: cpv.trim() ? [cpv.trim()] : undefined,
    };
  }

  async function onCreateAlert() {
    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const { error: createError } = await createOwnAlert(client, {
      userId,
      name: name.trim() || "Alerta",
      criteria: buildCriteria(),
      frequency: digestFrequency,
    });
    setPending(false);
    if (createError) {
      setError(createError.message);
      return;
    }
    router.refresh();
  }

  async function onCreateSavedSearch() {
    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const { error: createError } = await createOwnSavedSearch(client, {
      userId,
      name: name.trim() || "Búsqueda guardada",
      criteria: buildCriteria(),
    });
    setPending(false);
    if (createError) {
      setError(createError.message);
      return;
    }
    router.refresh();
  }

  const digestLabel = digestFrequency === "weekly" ? "semanal" : "diaria";

  return (
    <form className="mt-6 space-y-4 rounded-md border border-border bg-background p-4">
      <h2 className="text-base font-medium text-foreground">
        Crear alerta / búsqueda propia
      </h2>
      <div>
        <label htmlFor="item_name" className="block text-sm font-medium text-foreground">
          Nombre
        </label>
        <input
          id="item_name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div>
        <label htmlFor="keywords" className="block text-sm font-medium text-foreground">
          Keywords (separados por comas)
        </label>
        <input
          id="keywords"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div>
        <label htmlFor="cpv" className="block text-sm font-medium text-foreground">
          CPV
        </label>
        <input
          id="cpv"
          value={cpv}
          onChange={(e) => setCpv(e.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {error ? (
        <p className="rounded-md bg-surface px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={onCreateAlert}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
        >
          Crear alerta
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onCreateSavedSearch}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
        >
          Guardar búsqueda
        </button>
      </div>
      <p className="text-right text-xs text-muted-foreground">
        La configuración de frecuencia de tu cuenta es: {digestLabel}. Puedes
        cambiarla en{" "}
        <a href="/account" className="font-medium text-link hover:underline">
          Cuenta
        </a>
        .
      </p>
    </form>
  );
}
