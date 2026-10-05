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
  const [name, setName] = useState("Alerta software");
  const [keywords, setKeywords] = useState("software,mantenimiento");
  const [cpv, setCpv] = useState("72000000");
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

  return (
    <form className="mt-6 space-y-4 rounded-md border border-zinc-200 bg-white p-4">
      <h2 className="text-base font-medium text-zinc-900">Crear (propio)</h2>
      <p className="text-sm text-zinc-600">
        El email de coincidencias usa la frecuencia de tu cuenta (
        {digestFrequency === "weekly" ? "semanal" : "diaria"}). Cámbiala en{" "}
        <a href="/account" className="underline">
          Cuenta
        </a>
        .
      </p>
      <div>
        <label htmlFor="item_name" className="block text-sm font-medium text-zinc-800">
          Nombre
        </label>
        <input
          id="item_name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
        />
      </div>
      <div>
        <label htmlFor="keywords" className="block text-sm font-medium text-zinc-800">
          Keywords (coma)
        </label>
        <input
          id="keywords"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
        />
      </div>
      <div>
        <label htmlFor="cpv" className="block text-sm font-medium text-zinc-800">
          CPV
        </label>
        <input
          id="cpv"
          value={cpv}
          onChange={(e) => setCpv(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 outline-none focus:border-zinc-500"
        />
      </div>
      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={onCreateAlert}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          Crear alerta
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onCreateSavedSearch}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-60"
        >
          Guardar búsqueda
        </button>
      </div>
    </form>
  );
}
