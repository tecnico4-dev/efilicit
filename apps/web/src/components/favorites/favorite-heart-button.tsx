"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

/**
 * Corazón en lista de resultados: vacío = no favorito; rojo = favorito.
 * Al añadir: burbuja flotante Eficen / Subcontrata bajo el corazón (sin crecer la fila).
 */
export function FavoriteHeartButton({
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
  const rootRef = useRef<HTMLDivElement>(null);
  const [favorited, setFavorited] = useState(initiallyFavorited);
  const [pending, setPending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [nudgeKey, setNudgeKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pending && !pickerOpen) setFavorited(initiallyFavorited);
  }, [initiallyFavorited, pending, pickerOpen]);

  useEffect(() => {
    if (!pickerOpen || pending) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPickerOpen(false);
        setError(null);
      }
    }

    function onPointerDown(e: PointerEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (e.target instanceof Node && root.contains(e.target)) return;
      setPickerOpen(false);
      setError(null);
    }

    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
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
      router.refresh();
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
    router.refresh();
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
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

      {pickerOpen && !favorited ? (
        <div className="absolute left-1/2 top-full z-50 mt-1.5 -translate-x-1/2">
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
        </div>
      ) : null}
    </div>
  );
}
