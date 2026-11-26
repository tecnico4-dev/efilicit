"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useUndoToast } from "@/components/undo-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { removeFavoriteShare, restoreFavoriteShare } from "@/lib/queries";

/** Quitar de mi bandeja (hide por lado) con toast Revertir. */
export function RemoveFavoriteShareButton({ shareId }: { shareId: string }) {
  const router = useRouter();
  const { showUndo, showStatus } = useUndoToast();
  const [pending, setPending] = useState(false);

  async function onRemove() {
    if (pending) return;
    setPending(true);
    const client = createSupabaseBrowserClient();
    const { error } = await removeFavoriteShare(client, shareId);
    setPending(false);
    if (error) {
      showStatus(error.message);
      return;
    }
    showUndo("Quitada de tu lista.", async () => {
      const c = createSupabaseBrowserClient();
      const { error: restoreError } = await restoreFavoriteShare(c, shareId);
      if (restoreError) {
        showStatus(`No se pudo revertir: ${restoreError.message}`);
        return;
      }
      router.refresh();
    });
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => void onRemove()}
    >
      {pending ? "…" : "Quitar"}
    </Button>
  );
}
