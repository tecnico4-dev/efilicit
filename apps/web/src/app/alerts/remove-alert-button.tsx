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

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M4 6h16" />
      <path d="M7 6v13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

/** Elimina una alerta con aviso y Revertir (mismo patrón que búsquedas). */
export function RemoveAlertButton({
  alert,
  disabled = false,
}: {
  alert: AlertRow;
  disabled?: boolean;
}) {
  const router = useRouter();
  const { showUndo } = useUndoToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRemove() {
    if (pending || disabled) return;
    setPending(true);
    setError(null);

    const snapshot = {
      userId: alert.user_id,
      name: alert.name,
      criteria: parseCriteria(alert.criteria),
      frequency: (alert.frequency === "semanal"
        ? "semanal"
        : "diaria") as DigestFrequency,
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
        disabled={pending || disabled}
        onClick={onRemove}
        aria-label="Eliminar alerta"
        title="Eliminar"
        className="size-8 border-destructive px-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        {pending ? (
          <span className="text-xs">…</span>
        ) : (
          <TrashIcon className="size-4" />
        )}
      </Button>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
