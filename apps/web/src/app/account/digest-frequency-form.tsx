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
    <div className="mt-8 rounded-md border border-border bg-background p-4">
      <h2 className="text-base font-medium text-foreground">Email de alertas</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Un correo con todas tus alertas. Diario, o semanal (lunes UTC).
      </p>
      <div className="mt-4">
        <label htmlFor="digest_frequency" className="block text-sm font-medium text-foreground">
          Frecuencia
        </label>
        <select
          id="digest_frequency"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as DigestFrequency)}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="diaria">Diario</option>
          <option value="semanal">Semanal</option>
        </select>
      </div>
      {error ? (
        <p className="mt-3 rounded-md bg-surface px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mt-3 rounded-md bg-muted px-3 py-2 text-sm text-foreground">
          Preferencia guardada. Tus alertas usan esta frecuencia.
        </p>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={onSave}
        className="mt-4 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
      >
        Guardar
      </button>
    </div>
  );
}
