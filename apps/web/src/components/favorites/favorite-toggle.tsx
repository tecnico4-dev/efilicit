"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { addOwnFavorite, removeOwnFavorite } from "@/lib/queries";

/**
 * Marca / desmarca favorito. Solo se monta con sesión (la ficha no lo
 * renderiza para anónimos).
 */
export function FavoriteToggle({
  userId,
  tenderId,
  initiallyFavorited,
}: {
  userId: string;
  tenderId: string;
  initiallyFavorited: boolean;
}) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(initiallyFavorited);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onToggle() {
    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();

    if (favorited) {
      const { error: removeError } = await removeOwnFavorite(client, {
        userId,
        tenderId,
      });
      setPending(false);
      if (removeError) {
        setError(removeError.message);
        return;
      }
      setFavorited(false);
    } else {
      const { error: addError } = await addOwnFavorite(client, {
        userId,
        tenderId,
      });
      setPending(false);
      if (addError) {
        setError(addError.message);
        return;
      }
      setFavorited(true);
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={onToggle}
        className={
          favorited
            ? "border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
            : undefined
        }
      >
        {pending
          ? "…"
          : favorited
            ? "Quitar de favoritos"
            : "Guardar en favoritos"}
      </Button>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
