"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  addOwnFavorite,
  removeOwnFavorite,
  type FavoriteKind,
} from "@/lib/queries";
import { FavoriteKindSplitPicker } from "./favorite-kind-split-picker";

/**
 * Marca / desmarca favorito. Al añadir: burbuja Eficen / Subcontrata.
 * Solo se monta con sesión (la ficha no lo renderiza para anónimos).
 */
export function FavoriteToggle({
  userId,
  tenderId,
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pickerOpen || pending) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPickerOpen(false);
        setError(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickerOpen, pending]);

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
      setPickerOpen(false);
      router.refresh();
      return;
    }

    if (pickerOpen) {
      setPickerOpen(false);
      return;
    }

    setPickerOpen(true);
  }

  async function onPickKind(kind: FavoriteKind) {
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
    setPickerOpen(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        aria-expanded={!favorited && pickerOpen}
        onClick={() => void onToggle()}
        className={
          favorited
            ? "border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
            : undefined
        }
      >
        {pending && !pickerOpen
          ? "…"
          : favorited
            ? "Quitar de favoritos"
            : "Guardar en favoritos"}
      </Button>

      {pickerOpen && !favorited ? (
        <FavoriteKindSplitPicker
          pending={pending}
          onPick={(kind) => void onPickKind(kind)}
        />
      ) : null}

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
