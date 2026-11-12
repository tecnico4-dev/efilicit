"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  favoriteKindLongLabel,
  type FavoriteKind,
} from "@/lib/queries";

/**
 * Modal obligatorio: Propias de Eficen / Subcontrata al guardar en favoritos.
 */
export function FavoriteKindModal({
  open,
  title,
  pending = false,
  error = null,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title?: string | null;
  pending?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (kind: FavoriteKind) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [kind, setKind] = useState<FavoriteKind | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setKind(null);
    setLocalError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onClose]);

  if (!mounted || !open) return null;

  function confirm() {
    if (kind == null) {
      setLocalError("Elige Propias de Eficen o Subcontrata.");
      return;
    }
    onConfirm(kind);
  }

  const alert = localError ?? error;

  return createPortal(
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="favorite-kind-title"
      onClick={() => !pending && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="favorite-kind-title"
          className="text-lg font-semibold text-foreground"
        >
          Guardar en favoritos
        </h2>
        {title?.trim() ? (
          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
            {title.trim()}
          </p>
        ) : null}

        <div className="mt-4" role="group" aria-label="Tipo de favorito">
          <p className="mb-1.5 text-xs text-muted-foreground">
            ¿Dónde la clasificas?
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["propia", favoriteKindLongLabel("propia")],
                ["subcontrata", favoriteKindLongLabel("subcontrata")],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                disabled={pending}
                aria-pressed={kind === value}
                onClick={() => {
                  setKind(value);
                  setLocalError(null);
                }}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                  kind === value
                    ? "border-primary/50 bg-primary/15 text-primary-dark"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {alert ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {alert}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={pending || kind == null}
            onClick={confirm}
          >
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
