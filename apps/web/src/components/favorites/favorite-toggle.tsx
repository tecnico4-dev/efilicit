"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnchoredPortal } from "@/components/ui/anchored-portal";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  addOwnFavorite,
  removeOwnFavorite,
  type FavoriteKind,
} from "@/lib/queries";
import { FavoriteKindSplitPicker } from "./favorite-kind-split-picker";

const PICKER_WIDTH_PX = 200;

/**
 * Marca / desmarca favorito. Al añadir: burbuja en portal fijo (escapa overflow).
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
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [favorited, setFavorited] = useState(initiallyFavorited);
  const [pending, setPending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [nudgeKey, setNudgeKey] = useState(0);
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
      setNudgeKey((k) => k + 1);
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
    <div className="relative inline-flex flex-col items-start">
      <span ref={anchorRef} className="inline-flex">
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
      </span>

      <AnchoredPortal
        open={pickerOpen && !favorited}
        anchorRef={anchorRef}
        onDismiss={() => {
          if (!pending) {
            setPickerOpen(false);
            setError(null);
          }
        }}
        gap={6}
        matchAnchorWidth={false}
        align="start"
        minWidth={PICKER_WIDTH_PX}
        maxWidth={PICKER_WIDTH_PX}
        maxHeight={null}
        overflowY="visible"
        className="border-0 bg-transparent p-0 py-0 shadow-none"
      >
        <FavoriteKindSplitPicker
          pending={pending}
          nudgeKey={nudgeKey}
          onPick={(kind) => void onPickKind(kind)}
        />
        {error ? (
          <p className="mt-1 text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </AnchoredPortal>
    </div>
  );
}
