"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

const RECOMMENDATIONS_INFO =
  "Esta página muestra recomendaciones temporales según tus puntuaciones y favoritos. Cuando valores una licitación o la guardes en favoritos, dejará de aparecer aquí. El listado se recalcula de vez en cuando: una licitación también puede desaparecer aunque no la hayas valorado ni guardado.";

/**
 * «i» tipográfica (mismo estilo que política de contraseña): tip al click.
 */
export function RecommendationsInfoButton({
  className,
}: {
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
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
      {open ? (
        <p
          id={tipId}
          role="status"
          className="absolute left-0 top-full z-20 mt-1.5 w-[min(22rem,calc(100vw-2rem))] rounded-md border border-border bg-surface px-3 py-2 text-xs leading-relaxed text-foreground shadow-md sm:left-auto sm:right-0"
        >
          {RECOMMENDATIONS_INFO}
        </p>
      ) : null}
    </div>
  );
}
