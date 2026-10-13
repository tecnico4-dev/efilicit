"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUndoToast } from "@/components/undo-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  updateOwnDigestFrequency,
  type DigestFrequency,
} from "@/lib/queries";

/** Preferencia de cuenta editable desde Alertas (misma sync que en Cuenta). */
export function DigestFrequencyControl({
  userId,
  initialFrequency,
}: {
  userId: string;
  initialFrequency: DigestFrequency;
}) {
  const router = useRouter();
  const { showStatus } = useUndoToast();
  const [frequency, setFrequency] = useState<DigestFrequency>(initialFrequency);
  const [pending, setPending] = useState(false);

  async function onChange(next: DigestFrequency) {
    if (next === frequency || pending) return;
    const previous = frequency;
    setFrequency(next);
    setPending(true);

    const client = createSupabaseBrowserClient();
    const { error } = await updateOwnDigestFrequency(client, {
      userId,
      digestFrequency: next,
    });
    setPending(false);

    if (error) {
      setFrequency(previous);
      showStatus("No se pudo actualizar la frecuencia. Inténtalo de nuevo.");
      return;
    }

    showStatus("Se ha actualizado la frecuencia de tus notificaciones.");
    router.refresh();
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <label
        htmlFor="alerts_digest_frequency"
        className="text-muted-foreground"
      >
        Frecuencia de las notificaciones:
      </label>
      <select
        id="alerts_digest_frequency"
        value={frequency}
        disabled={pending}
        onChange={(e) => onChange(e.target.value as DigestFrequency)}
        className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
      >
        <option value="daily">Diaria</option>
        <option value="weekly">Semanal</option>
      </select>
    </div>
  );
}
