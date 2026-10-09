"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useUndoToast } from "@/components/undo-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  createOwnAlert,
  deleteOwnAlert,
  updateOwnAlert,
  type DigestFrequency,
} from "@/lib/queries";
import { parseCriteria } from "@/lib/criteria-display";
import type { Database } from "@efilicit/types";

type AlertRow = Database["public"]["Tables"]["alerts"]["Row"];

/** Elimina una alerta con aviso y Revertir (mismo patrón que búsquedas). */
export function RemoveAlertButton({ alert }: { alert: AlertRow }) {
  const router = useRouter();
  const { showUndo } = useUndoToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRemove() {
    if (pending) return;
    setPending(true);
    setError(null);

    const snapshot = {
      userId: alert.user_id,
      name: alert.name,
      criteria: parseCriteria(alert.criteria),
      frequency: (alert.frequency === "weekly"
        ? "weekly"
        : "daily") as DigestFrequency,
      wasActive: alert.is_active,
    };

    const client = createSupabaseBrowserClient();
    const { error: deleteError } = await deleteOwnAlert(client, {
      alertId: alert.id,
    });
    setPending(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    showUndo("Has eliminado la alerta.", async () => {
      const c = createSupabaseBrowserClient();
      const { data } = await createOwnAlert(c, {
        userId: snapshot.userId,
        name: snapshot.name,
        criteria: snapshot.criteria,
        frequency: snapshot.frequency,
      });
      if (data && !snapshot.wasActive) {
        await updateOwnAlert(c, { alertId: data.id, isActive: false });
      }
      router.refresh();
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={onRemove}
        className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        {pending ? "…" : "Eliminar"}
      </Button>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
