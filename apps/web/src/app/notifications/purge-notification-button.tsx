"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUndoToast } from "@/components/undo-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { permanentlyDeleteOwnFavoriteNotification } from "@/lib/queries";

/**
 * Eliminar definitivo desde Papelera (favoritos).
 * Oculta en UI; a los ~7s (o al cerrar el toast) marca deleted en BD.
 * Revertir cancela y vuelve a mostrar.
 */
export function PurgeNotificationButton({
  userId,
  eventId,
  onHide,
  onShow,
}: {
  userId: string;
  eventId: string;
  onHide: () => void;
  onShow: () => void;
}) {
  const router = useRouter();
  const { showPendingConfirm, showStatus } = useUndoToast();
  const [pending, setPending] = useState(false);

  function onPurge(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    setPending(true);
    onHide();
    setPending(false);

    showPendingConfirm("Notificación eliminada definitivamente.", {
      onConfirm: async () => {
        const client = createSupabaseBrowserClient();
        const { error } = await permanentlyDeleteOwnFavoriteNotification(
          client,
          { userId, eventId },
        );
        if (error) {
          showStatus(`No se pudo eliminar: ${error.message}`);
          onShow();
          return;
        }
        router.refresh();
      },
      onUndo: () => {
        onShow();
      },
    });
  }

  return (
    <button
      type="button"
      onClick={onPurge}
      disabled={pending}
      aria-label="Eliminar definitivamente"
      title="Eliminar definitivamente"
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
    >
      <TrashIcon className="size-4" />
    </button>
  );
}

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
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}
