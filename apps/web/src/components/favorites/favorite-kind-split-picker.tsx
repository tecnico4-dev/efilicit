"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { type FavoriteKind } from "@/lib/queries";

/**
 * Burbuja partida en diagonal (/) Eficen (teal) | Subcontrata (violeta).
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
      className="relative h-7 w-[11.75rem] max-w-full shrink-0 overflow-hidden rounded-full border-2 border-border bg-border shadow-sm"
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
          "absolute inset-0 transition-colors disabled:opacity-80",
          "bg-teal-600/12 text-teal-800 hover:bg-teal-600/28 dark:text-teal-200",
          flash === "propia" && "bg-teal-600/45 text-teal-950 dark:text-teal-50",
        )}
        style={{
          // Mitad izquierda con corte / (arriba más a la derecha).
          clipPath: "polygon(0 0, 56% 0, 44% 100%, 0 100%)",
        }}
      >
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-medium">
          Eficen
        </span>
      </button>
      <button
        type="button"
        disabled={pending || flash != null}
        aria-label="Subcontrata"
        onClick={() => pick("subcontrata")}
        className={cn(
          "absolute inset-0 transition-colors disabled:opacity-80",
          "bg-violet-500/12 text-violet-800 hover:bg-violet-500/28 dark:text-violet-200",
          flash === "subcontrata" &&
            "bg-violet-500/45 text-violet-950 dark:text-violet-50",
        )}
        style={{
          // Mitad derecha; hueco ~2% deja la diagonal visible (fondo border).
          clipPath: "polygon(58% 0, 100% 0, 100% 100%, 46% 100%)",
        }}
      >
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-medium">
          Subcontrata
        </span>
      </button>
    </div>
  );
}
