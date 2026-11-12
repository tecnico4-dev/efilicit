"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useUndoToast } from "@/components/undo-toast";
import { cn } from "@/lib/cn";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  SHARED_FAVORITE_NOTES_MAX,
  addSharedFavorite,
  favoriteKindLongLabel,
  getSharedFavoriteOwner,
  sharedFavoriteAlreadyMessage,
  type FavoriteKind,
  type SharedFavoriteOwnerInfo,
} from "@/lib/queries";

function PaperPlaneIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4Z" />
    </svg>
  );
}

/**
 * Añadir a Común desde el listado ampliado de favoritos propios.
 * El kind se hereda del favorito personal (no se vuelve a preguntar).
 * Si ya está en Común: toast inmediato, sin modal.
 */
export function ShareToCommonButton({
  userId,
  tenderId,
  tenderTitle,
  kind,
  alreadySharedOwner = null,
}: {
  userId: string;
  tenderId: string;
  tenderTitle: string;
  kind: FavoriteKind;
  alreadySharedOwner?: SharedFavoriteOwnerInfo | null;
}) {
  const router = useRouter();
  const { showStatus } = useUndoToast();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kindLabel = favoriteKindLongLabel(kind);
  const alreadyShared = alreadySharedOwner != null;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function onPlaneClick() {
    if (pending) return;

    if (alreadySharedOwner) {
      showStatus(sharedFavoriteAlreadyMessage(userId, alreadySharedOwner));
      return;
    }

    // Por si el listado está desfasado: comprobar antes de abrir el modal.
    setPending(true);
    const client = createSupabaseBrowserClient();
    const existing = await getSharedFavoriteOwner(client, tenderId);
    setPending(false);

    if (existing.error) {
      showStatus(existing.error.message);
      return;
    }
    if (existing.data) {
      showStatus(
        sharedFavoriteAlreadyMessage(userId, {
          addedBy: existing.data.addedBy,
          displayName: existing.data.displayName,
        }),
      );
      router.refresh();
      return;
    }

    setNotes("");
    setError(null);
    setOpen(true);
  }

  async function onConfirm() {
    if (pending) return;
    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const result = await addSharedFavorite(client, {
      userId,
      tenderId,
      kind,
      notes,
    });
    setPending(false);

    if (result.ok) {
      setOpen(false);
      showStatus(`Añadida a Común (${kindLabel}).`);
      router.refresh();
      return;
    }

    if (result.alreadyExists) {
      setOpen(false);
      showStatus(sharedFavoriteAlreadyMessage(userId, result.owner));
      router.refresh();
      return;
    }

    setError(result.error.message);
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => void onPlaneClick()}
        aria-label={
          alreadyShared
            ? "Ya está en Común"
            : "Añadir a Común"
        }
        title={alreadyShared ? "Ya está en Común" : "Añadir a Común"}
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-md transition-colors",
          alreadyShared
            ? "text-primary hover:bg-primary/10"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          pending && "opacity-50",
        )}
      >
        <PaperPlaneIcon className="size-4" />
      </button>

      {mounted && open
        ? createPortal(
            <div
              className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="share-to-common-title"
              onClick={() => !pending && setOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h2
                  id="share-to-common-title"
                  className="text-lg font-semibold text-foreground"
                >
                  Añadir a Común
                </h2>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                  {tenderTitle}
                </p>

                <p className="mt-4 text-sm text-foreground">
                  Calificada como{" "}
                  <span className="font-semibold">{kindLabel}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Así se enviará a Común.
                </p>

                <label className="mt-4 flex flex-col gap-1.5 text-xs text-muted-foreground">
                  Nota (opcional)
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={SHARED_FAVORITE_NOTES_MAX}
                    rows={3}
                    disabled={pending}
                    placeholder="Motivo o comentario para el equipo…"
                    className="resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <span className="tabular-nums text-[11px]">
                    {notes.length}/{SHARED_FAVORITE_NOTES_MAX}
                  </span>
                </label>
                {error ? (
                  <p className="mt-2 text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="mt-5 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => setOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending}
                    onClick={() => void onConfirm()}
                  >
                    {pending ? "Añadiendo…" : "Añadir"}
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
