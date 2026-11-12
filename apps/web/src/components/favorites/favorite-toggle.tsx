"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  addOwnFavorite,
  removeOwnFavorite,
  type FavoriteKind,
} from "@/lib/queries";
import { FavoriteKindModal } from "./favorite-kind-modal";

/**
 * Marca / desmarca favorito. Al añadir: modal obligatorio Eficen / Subcontrata.
 * Solo se monta con sesión (la ficha no lo renderiza para anónimos).
 */
export function FavoriteToggle({
  userId,
  tenderId,
  tenderTitle,
  initiallyFavorited,
}: {
  userId: string;
  tenderId: string;
  tenderTitle?: string | null;
  initiallyFavorited: boolean;
}) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(initiallyFavorited);
  const [pending, setPending] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onToggle() {
    if (pending) return;
    setError(null);

    if (favorited) {
      setPending(true);
      const client = createSupabaseBrowserClient();
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
      router.refresh();
      return;
    }

    setModalOpen(true);
  }

  async function onConfirmKind(kind: FavoriteKind) {
    if (pending) return;
    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const { error: addError } = await addOwnFavorite(client, {
      userId,
      tenderId,
      kind,
    });
    setPending(false);
    if (addError) {
      setError(addError.message);
      return;
    }
    setFavorited(true);
    setModalOpen(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => void onToggle()}
        className={
          favorited
            ? "border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
            : undefined
        }
      >
        {pending && !modalOpen
          ? "…"
          : favorited
            ? "Quitar de favoritos"
            : "Guardar en favoritos"}
      </Button>
      {error && !modalOpen ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <FavoriteKindModal
        open={modalOpen}
        title={tenderTitle}
        pending={pending}
        error={error}
        onClose={() => {
          if (!pending) {
            setModalOpen(false);
            setError(null);
          }
        }}
        onConfirm={(kind) => void onConfirmKind(kind)}
      />
    </div>
  );
}
