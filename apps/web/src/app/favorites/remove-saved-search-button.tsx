"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { deleteOwnSavedSearch } from "@/lib/queries";

/** Quita una búsqueda guardada (mismo tono de acción que el resto de links de la fila). */
export function RemoveSavedSearchButton({ searchId }: { searchId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRemove() {
    if (pending) return;
    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const { error: deleteError } = await deleteOwnSavedSearch(client, {
      searchId,
    });
    setPending(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
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
