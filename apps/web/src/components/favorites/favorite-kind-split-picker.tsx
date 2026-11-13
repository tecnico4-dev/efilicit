"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { type FavoriteKind } from "@/lib/queries";

/** Reborde exterior + corte `/`: degradado homogéneo teal → violeta. */
const BORDER_GRADIENT =
  "linear-gradient(135deg, #0f766e 0%, #0d9488 42%, #7c3aed 58%, #6d28d9 100%)";

/**
 * Burbuja partida en diagonal (/).
 * - Borde exterior y `/`: degradado oscuro teal → violeta.
 * - Fondos de cada mitad: teal / violeta claritos (opacos).
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
        "h-7 w-[12.5rem] shrink-0 rounded-full p-[2px] shadow-md",
        nudge && "fav-kind-nudge",
        className,
      )}
      style={{ background: BORDER_GRADIENT }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {/* Mismo degradado: solo se ve en el hueco del `/`. */}
      <div
        className="relative h-full w-full overflow-hidden rounded-full"
        style={{ background: BORDER_GRADIENT }}
      >
        <button
          type="button"
          disabled={pending || flash != null}
          aria-label="Propias de Eficen"
          onClick={() => pick("propia")}
          className={cn(
            "absolute inset-0 transition-colors disabled:opacity-80",
            "bg-teal-100 text-teal-900 hover:bg-teal-200 dark:bg-teal-900/80 dark:text-teal-100 dark:hover:bg-teal-800",
            flash === "propia" && "bg-teal-300 dark:bg-teal-600",
          )}
          style={{
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
            "bg-violet-100 text-violet-900 hover:bg-violet-200 dark:bg-violet-900/80 dark:text-violet-100 dark:hover:bg-violet-800",
            flash === "subcontrata" && "bg-violet-300 dark:bg-violet-600",
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
    </div>
  );
}
