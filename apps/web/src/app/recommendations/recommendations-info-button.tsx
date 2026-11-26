"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { formatDateTimeMadrid } from "@/lib/datetime";

/**
 * «i» tipográfica (mismo estilo que política de contraseña): tip al click.
 * El tip va en portal (z alto) para no quedar bajo el listado.
 */
export function RecommendationsInfoButton({
  className,
  computedAt = null,
}: {
  className?: string;
  computedAt?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );
  const tipId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const lastComputed = computedAt
    ? formatDateTimeMadrid(computedAt)
    : "aún no hay cálculo";

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      setCoords(null);
      return;
    }
    function place() {
      const btn = rootRef.current?.querySelector("button");
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const tipW = Math.min(22 * 16, window.innerWidth - 16);
      let left = r.left;
      if (left + tipW > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - tipW - 8);
      }
      setCoords({ top: r.bottom + 6, left });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (tipRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={tipId}
        aria-label="Qué son las recomendaciones"
        onClick={() => setOpen((v) => !v)}
        className="flex h-6 w-6 items-center justify-center rounded-full border border-primary/35 bg-primary-light/70 font-serif text-[0.85rem] leading-none text-primary-dark italic hover:border-primary/55 hover:bg-primary-light"
      >
        i
      </button>
      {mounted && open && coords
        ? createPortal(
            <div
              ref={tipRef}
              id={tipId}
              role="status"
              style={{ top: coords.top, left: coords.left }}
              className="fixed z-[200] w-[min(22rem,calc(100vw-2rem))] space-y-2 rounded-md border border-border bg-surface px-3 py-2.5 text-xs leading-relaxed text-foreground shadow-md"
            >
              <p className="font-medium text-foreground">
                Esta página muestra recomendaciones temporales según tus
                puntuaciones y favoritos.
              </p>
              <p className="text-muted-foreground">
                Cuando valores una licitación o la guardes en favoritos, dejará
                de aparecer aquí.
              </p>
              <p className="text-muted-foreground">
                El listado se recalcula automáticamente (Última vez:{" "}
                {lastComputed}). Una licitación también puede desaparecer aunque
                no la hayas valorado ni guardado si deja de encajar contigo.
              </p>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
