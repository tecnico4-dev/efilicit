"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUndoToast } from "@/components/undo-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  restoreOwnNotificationFromTrash,
  trashOwnNotification,
} from "@/lib/queries";

/** Icono papelera: mueve el aviso a Papelera (con deshacer). */
export function TrashNotificationButton({
  userId,
  eventId,
}: {
  userId: string;
  eventId: string;
}) {
  const router = useRouter();
  const { showUndo, showStatus } = useUndoToast();
  const [pending, setPending] = useState(false);

  async function onTrash(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    setPending(true);
    const client = createSupabaseBrowserClient();
    const { error } = await trashOwnNotification(client, { userId, eventId });
    setPending(false);
    if (error) {
      showStatus(`No se pudo mover a la papelera: ${error.message}`);
      return;
    }
    showUndo("Notificación movida a la papelera.", async () => {
      const c = createSupabaseBrowserClient();
      await restoreOwnNotificationFromTrash(c, { userId, eventId });
      router.refresh();
    });
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onTrash}
      disabled={pending}
      aria-label="Mover a la papelera"
      title="Mover a la papelera"
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-50"
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
