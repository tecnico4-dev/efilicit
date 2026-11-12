"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUndoToast } from "@/components/undo-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { removeSharedFavorite } from "@/lib/queries";

/** Quitar de Común (cualquier usuario app). */
export function RemoveSharedFavoriteButton({
  tenderId,
}: {
  tenderId: string;
}) {
  const router = useRouter();
  const { showStatus } = useUndoToast();
  const [pending, setPending] = useState(false);

  async function onRemove() {
    if (pending) return;
    const ok = window.confirm("¿Quitar esta licitación de Común?");
    if (!ok) return;
    setPending(true);
    const client = createSupabaseBrowserClient();
    const { error } = await removeSharedFavorite(client, tenderId);
    setPending(false);
    if (error) {
      showStatus(`No se pudo quitar: ${error.message}`);
      return;
    }
    showStatus("Quitada de Común.");
    router.refresh();
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void onRemove()}
      className="text-sm font-medium text-muted-foreground underline-offset-2 hover:text-destructive hover:underline disabled:opacity-50"
    >
      Quitar
    </button>
  );
}
