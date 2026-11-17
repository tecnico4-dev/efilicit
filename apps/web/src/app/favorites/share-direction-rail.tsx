"use client";

import { cn } from "@/lib/cn";
import type { FavoriteShareDirection } from "@/lib/queries";

export type ShareBandeja = "todas" | FavoriteShareDirection;

const BANDEJA_OPTIONS: {
  id: ShareBandeja;
  label: string;
}[] = [
  { id: "todas", label: "Todas" },
  { id: "received", label: "Recibidas" },
  { id: "sent", label: "Enviadas" },
];

/**
 * Desktop: rail vertical redondeado (hueco respecto al listado).
 * Móvil: desplegable «Bandeja: …».
 */
export function ShareDirectionRail({
  value,
  onChange,
  counts,
}: {
  value: ShareBandeja;
  onChange: (next: ShareBandeja) => void;
  counts: Record<ShareBandeja, number>;
}) {
  return (
    <>
      <label className="mb-3 flex flex-col gap-1 text-xs text-muted-foreground md:hidden">
        Bandeja
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as ShareBandeja)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Bandeja"
        >
          {BANDEJA_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label} ({counts[opt.id]})
            </option>
          ))}
        </select>
      </label>

      <nav
        aria-label="Bandeja de compartidas"
        className="hidden w-[7.25rem] shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-background md:flex"
      >
        {BANDEJA_OPTIONS.map((opt, i) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onChange(opt.id)}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 px-2.5 py-2.5 text-left text-sm transition-colors",
                i > 0 && "border-t border-border",
                active
                  ? "bg-primary/15 font-semibold text-primary-dark"
                  : "font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <span>{opt.label}</span>
              <span
                className={cn(
                  "text-[11px] font-semibold tabular-nums",
                  active ? "text-primary-dark/80" : "text-muted-foreground",
                )}
              >
                {counts[opt.id]}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
