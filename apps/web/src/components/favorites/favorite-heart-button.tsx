"use client";

import { useEffect, useRef, useState } from "react";
import { AnchoredPortal } from "@/components/ui/anchored-portal";
import { cn } from "@/lib/cn";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  addOwnFavorite,
  removeOwnFavorite,
  type FavoriteKind,
} from "@/lib/queries";
import { FavoriteKindSplitPicker } from "./favorite-kind-split-picker";

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19.5 12.572 12 20l-7.5-7.428A5 5 0 1 1 12 5.072a5 5 0 1 1 7.5 7.5Z" />
    </svg>
  );
}

const PICKER_WIDTH_PX = 200;

/**
 * Corazón en lista de resultados: vacío = no favorito; rojo = favorito.
 * Al añadir: burbuja en portal fijo bajo el corazón (escapa overflow del listado).
 */
export function FavoriteHeartButton({
  userId,
  tenderId,
  initiallyFavorited,
  onFavoritedChange,
}: {
  userId: string;
  tenderId: string;
  tenderTitle?: string | null;
  initiallyFavorited: boolean;
  /**
   * Avisa al padre (listado / ficha).
   * Al añadir, `kind` es el elegido; al quitar, `null`.
   */
  onFavoritedChange?: (
    tenderId: string,
    favorited: boolean,
    kind: FavoriteKind | null,
  ) => void;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [favorited, setFavorited] = useState(initiallyFavorited);
  const [pending, setPending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [nudgeKey, setNudgeKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Solo cuando el padre trae un valor nuevo (p. ej. otra búsqueda), no al cerrar el picker.
  useEffect(() => {
    setFavorited(initiallyFavorited);
  }, [initiallyFavorited]);

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

  async function onToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;

    if (favorited) {
      setPending(true);
      const client = createSupabaseBrowserClient();
      const { error: removeError } = await removeOwnFavorite(client, {
        userId,
        tenderId,
      });
      if (removeError) {
        setPending(false);
        return;
      }
      setFavorited(false);
      setPickerOpen(false);
      setPending(false);
      onFavoritedChange?.(tenderId, false, null);
      return;
    }

    if (pickerOpen) {
      setNudgeKey((k) => k + 1);
      return;
    }

    setError(null);
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
    onFavoritedChange?.(tenderId, true, kind);
  }

  return (
    <div className="relative shrink-0">
      <button
        ref={anchorRef}
        type="button"
        disabled={pending}
        onClick={onToggle}
        aria-label={favorited ? "Quitar de favoritos" : "Guardar en favoritos"}
        aria-pressed={favorited}
        aria-expanded={!favorited && pickerOpen}
        className={cn(
          "shrink-0 rounded-md p-1.5 transition-colors outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50",
          favorited
            ? "text-destructive hover:bg-destructive/10"
            : "text-foreground hover:bg-muted",
        )}
      >
        <HeartIcon filled={favorited} />
      </button>

      <AnchoredPortal
        open={pickerOpen && !favorited}
        anchorRef={anchorRef}
        onDismiss={() => {
          if (!pending) {
            setPickerOpen(false);
            setError(null);
          }
        }}
        gap={3}
        matchAnchorWidth={false}
        align="center"
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
          <p
            className="mt-1 max-w-[12.5rem] text-center text-[11px] text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </AnchoredPortal>
    </div>
  );
}
