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
 * Desktop: rail vertical redondeado, independiente del listado.
 * Móvil: desplegable «Bandeja».
 */
export function ShareDirectionRail({
  value,
  onChange,
  counts,
  variant,
}: {
  value: ShareBandeja;
  onChange: (next: ShareBandeja) => void;
  counts: Record<ShareBandeja, number>;
  /** `mobile` = select; `desktop` = rail vertical. */
  variant: "mobile" | "desktop";
}) {
  if (variant === "mobile") {
    return (
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
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
    );
  }

  return (
    <nav
      aria-label="Bandeja de compartidas"
      className="flex w-[8.5rem] shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-background shadow-sm"
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
              "inline-flex w-full items-center gap-1.5 px-2.5 py-2 text-left text-sm transition-colors",
              i > 0 && "border-t border-border",
              active
                ? "bg-primary/15 font-semibold text-primary-dark"
                : "font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <span className="min-w-0 flex-1 truncate">{opt.label}</span>
            <span
              className={cn(
                "min-w-5 shrink-0 rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums",
                active
                  ? "bg-primary/20 text-primary-dark"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {counts[opt.id]}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
