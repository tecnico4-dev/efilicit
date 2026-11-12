"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUndoToast } from "@/components/undo-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  asFavoriteKind,
  createOwnAlert,
  deleteOwnAlert,
  listOwnQueueIdsForAlert,
  reassignOwnAlertQueueItems,
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

    const client = createSupabaseBrowserClient();
    // Antes del DELETE: ON DELETE SET NULL deja la cola sin alert_id.
    const queueIdsResult = await listOwnQueueIdsForAlert(client, {
      userId: alert.user_id,
      alertId: alert.id,
    });
    if (queueIdsResult.error) {
      setPending(false);
      setError(queueIdsResult.error.message);
      return;
    }

    const snapshot = {
      userId: alert.user_id,
      name: alert.name,
      criteria: parseCriteria(alert.criteria),
      kind: asFavoriteKind(alert.kind),
      frequency: (alert.frequency === "semanal"
        ? "semanal"
        : "diaria") as DigestFrequency,
      wasActive: alert.is_active,
      queueIds: queueIdsResult.data,
    };

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
        kind: snapshot.kind,
        frequency: snapshot.frequency,
      });
      if (!data) {
        router.refresh();
        return;
      }
      if (!snapshot.wasActive) {
        await updateOwnAlert(c, { alertId: data.id, isActive: false });
      }
      if (snapshot.queueIds.length > 0) {
        await reassignOwnAlertQueueItems(c, {
          userId: snapshot.userId,
          alertId: data.id,
          queueIds: snapshot.queueIds,
        });
      }
      router.refresh();
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending || disabled}
        onClick={onRemove}
        aria-label="Eliminar alerta"
        title="Eliminar"
        className="inline-flex size-8 items-center justify-center rounded-md text-foreground/75 transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
      >
        {pending ? (
          <span className="text-xs">…</span>
        ) : (
          <TrashIcon className="size-[1.15rem]" />
        )}
      </button>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
