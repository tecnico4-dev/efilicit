"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { type FavoriteKind } from "@/lib/queries";

/**
 * Burbuja partida en diagonal (/) Eficen (teal) | Subcontrata (violeta).
 * Mitades del mismo ancho; etiquetas centradas en cada hueco.
 */
export function FavoriteKindSplitPicker({
  pending = false,
  nudgeKey = 0,
  onPick,
  className,
}: {
  pending?: boolean;
  /** Incrementar para disparar rebote (p. ej. re-click en el corazón). */
  nudgeKey?: number;
  onPick: (kind: FavoriteKind) => void;
  className?: string;
}) {
  const [flash, setFlash] = useState<FavoriteKind | null>(null);
  const [nudge, setNudge] = useState(false);

  useEffect(() => {
    if (nudgeKey <= 0) return;
    setNudge(false);
    const id = window.requestAnimationFrame(() => setNudge(true));
    const t = window.setTimeout(() => setNudge(false), 400);
    return () => {
      window.cancelAnimationFrame(id);
      window.clearTimeout(t);
    };
  }, [nudgeKey]);

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
      className={cn(
        "relative h-7 w-[12.5rem] shrink-0 overflow-hidden rounded-full border-2 border-border bg-border shadow-md",
        nudge && "fav-kind-nudge",
        className,
      )}
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
          // Mitad izquierda; corte / simétrico (~50%).
          clipPath: "polygon(0 0, 54% 0, 46% 100%, 0 100%)",
        }}
      >
        <span className="absolute left-[25%] top-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-medium">
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
          clipPath: "polygon(56% 0, 100% 0, 100% 100%, 48% 100%)",
        }}
      >
        <span className="absolute left-[75%] top-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-medium">
          Subcontrata
        </span>
      </button>
    </div>
  );
}
