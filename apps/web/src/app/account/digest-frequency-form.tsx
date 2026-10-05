"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  updateOwnDigestFrequency,
  type DigestFrequency,
} from "@/lib/queries";

export function DigestFrequencyForm({
  userId,
  initialFrequency,
}: {
  userId: string;
  initialFrequency: DigestFrequency;
}) {
  const router = useRouter();
  const [frequency, setFrequency] = useState<DigestFrequency>(initialFrequency);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  async function onSave() {
    setPending(true);
    setError(null);
    setSaved(false);
    const client = createSupabaseBrowserClient();
    const { error: updateError } = await updateOwnDigestFrequency(client, {
      userId,
      digestFrequency: frequency,
    });
    setPending(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="mt-8 rounded-md border border-zinc-200 bg-white p-4">
      <h2 className="text-base font-medium text-zinc-900">Email de alertas</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Un correo con todas tus alertas. Diario, o semanal (lunes UTC).
      </p>
      <div className="mt-4">
        <label htmlFor="digest_frequency" className="block text-sm font-medium text-zinc-800">
          Frecuencia
        </label>
        <select
          id="digest_frequency"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as DigestFrequency)}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
        >
          <option value="daily">Diario</option>
          <option value="weekly">Semanal</option>
        </select>
      </div>
      {error ? (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Preferencia guardada. Tus alertas usan esta frecuencia.
        </p>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={onSave}
        className="mt-4 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        Guardar
      </button>
    </div>
  );
}
