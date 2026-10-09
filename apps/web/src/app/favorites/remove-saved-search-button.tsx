"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUndoToast } from "@/components/undo-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  createOwnSavedSearch,
  deleteOwnSavedSearch,
} from "@/lib/queries";
import { parseCriteria } from "@/lib/criteria-display";
import type { SearchCriteria } from "@efilicit/types";

/** Quita una búsqueda guardada, con aviso y Revertir durante unos segundos. */
export function RemoveSavedSearchButton({
  searchId,
  userId,
  name,
  criteria,
}: {
  searchId: string;
  userId: string;
  name: string;
  criteria: SearchCriteria;
}) {
  const router = useRouter();
  const { showUndo } = useUndoToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRemove() {
    if (pending) return;
    setPending(true);
    setError(null);
    const snapshot = {
      name,
      criteria: parseCriteria(criteria),
    };
    const client = createSupabaseBrowserClient();
    const { error: deleteError } = await deleteOwnSavedSearch(client, {
      searchId,
    });
    setPending(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    showUndo("Has eliminado la búsqueda guardada.", async () => {
      const c = createSupabaseBrowserClient();
      await createOwnSavedSearch(c, {
        userId,
        name: snapshot.name,
        criteria: snapshot.criteria,
      });
      router.refresh();
    });
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <button
        type="button"
        disabled={pending}
        onClick={onRemove}
        className="font-medium text-destructive hover:underline disabled:opacity-50"
      >
        {pending ? "Eliminando…" : "Eliminar"}
      </button>
      {error ? (
        <span className="text-xs text-destructive" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
