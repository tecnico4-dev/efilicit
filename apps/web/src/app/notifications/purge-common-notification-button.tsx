"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUndoToast } from "@/components/undo-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  permanentlyDeleteOwnCommonNotification,
  permanentlyDeleteOwnCommonRemovedNotification,
} from "@/lib/queries";

export function PurgeCommonNotificationButton({
  userId,
  tenderId,
  onHide,
  onShow,
  variant = "added",
}: {
  userId: string;
  tenderId: string;
  onHide: () => void;
  onShow: () => void;
  variant?: "added" | "removed";
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
        const { error } =
          variant === "removed"
            ? await permanentlyDeleteOwnCommonRemovedNotification(client, {
                userId,
                tenderId,
              })
            : await permanentlyDeleteOwnCommonNotification(client, {
                userId,
                tenderId,
              });
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
