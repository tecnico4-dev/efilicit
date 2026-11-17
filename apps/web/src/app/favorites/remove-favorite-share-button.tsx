"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useUndoToast } from "@/components/undo-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { removeFavoriteShare } from "@/lib/queries";

/** Quitar de mi bandeja (hide por lado; el otro sigue viéndola hasta que quite). */
export function RemoveFavoriteShareButton({ shareId }: { shareId: string }) {
  const router = useRouter();
  const { showStatus } = useUndoToast();
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
    showStatus("Quitada de tu lista.");
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
