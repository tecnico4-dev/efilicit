"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { type FavoriteKind } from "@/lib/queries";

/**
 * Burbuja partida Eficen (teal) / Subcontrata (violeta).
 * Al elegir una mitad: flash breve y el padre guarda el favorito.
 */
export function FavoriteKindSplitPicker({
  pending = false,
  onPick,
}: {
  pending?: boolean;
  onPick: (kind: FavoriteKind) => void;
}) {
  const [flash, setFlash] = useState<FavoriteKind | null>(null);

  function pick(kind: FavoriteKind) {
    if (pending || flash != null) return;
    setFlash(kind);
    window.setTimeout(() => {
      onPick(kind);
    }, 240);
  }

  return (
    <div
      role="group"
      aria-label="Clasificar favorito"
      className="inline-flex max-w-full items-stretch overflow-hidden rounded-full border border-border shadow-sm"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <button
        type="button"
        disabled={pending || flash != null}
        aria-label="Propias de Eficen"
        onClick={() => pick("propia")}
        className={cn(
          "px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-80",
          "bg-teal-600/12 text-teal-800 hover:bg-teal-600/28 dark:text-teal-200",
          flash === "propia" && "bg-teal-600/45 text-teal-950 dark:text-teal-50",
        )}
      >
        Eficen
      </button>
      <span
        aria-hidden
        className="flex items-center bg-background px-0.5 text-[11px] font-medium text-muted-foreground"
      >
        /
      </span>
      <button
        type="button"
        disabled={pending || flash != null}
        aria-label="Subcontrata"
        onClick={() => pick("subcontrata")}
        className={cn(
          "px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-80",
          "bg-violet-500/12 text-violet-800 hover:bg-violet-500/28 dark:text-violet-200",
          flash === "subcontrata" &&
            "bg-violet-500/45 text-violet-950 dark:text-violet-50",
        )}
      >
        Subcontrata
      </button>
    </div>
  );
}
