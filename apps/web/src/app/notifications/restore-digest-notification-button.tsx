"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUndoToast } from "@/components/undo-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  restoreOwnDigestInboxFromTrash,
  trashOwnDigestInboxNotification,
} from "@/lib/queries";

/** Recupera un aviso de digest de la papelera. */
export function RestoreDigestNotificationButton({
  userId,
  digestId,
}: {
  userId: string;
  digestId: string;
}) {
  const router = useRouter();
  const { showUndo, showStatus } = useUndoToast();
  const [pending, setPending] = useState(false);

  async function onRestore(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    setPending(true);
    const client = createSupabaseBrowserClient();
    const { error } = await restoreOwnDigestInboxFromTrash(client, {
      userId,
      digestId,
    });
    setPending(false);
    if (error) {
      showStatus(`No se pudo recuperar: ${error.message}`);
      return;
    }
    showUndo("Notificación recuperada.", async () => {
      const c = createSupabaseBrowserClient();
      await trashOwnDigestInboxNotification(c, { userId, digestId });
      router.refresh();
    });
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onRestore}
      disabled={pending}
      aria-label="Recuperar notificación"
      title="Recuperar"
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-primary disabled:opacity-50"
    >
      <RestoreIcon className="size-4" />
    </button>
  );
}

function RestoreIcon({ className }: { className?: string }) {
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
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}
