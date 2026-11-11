"use client";

import { useRef, useState } from "react";
import { AnchoredPortal } from "@/components/ui/anchored-portal";
import { cn } from "@/lib/cn";

/**
 * Filtro Alerta (Coincidencias): el valor visible y las opciones se truncan
 * al ancho del control (nombres largos no desbordan el cuadrado).
 */
export function AlertFilterSelect({
  id,
  value,
  options,
  onChange,
  widthPx,
  disabled,
  allLabel = "Todas",
}: {
  id: string;
  value: string;
  options: { id: string; name: string }[];
  onChange: (next: string) => void;
  widthPx: number | null;
  disabled?: boolean;
  allLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedLabel =
    value === "all"
      ? allLabel
      : (options.find((o) => o.id === value)?.name ?? allLabel);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <div
      className="flex flex-col gap-1 text-xs text-muted-foreground"
      style={
        widthPx != null ? { width: widthPx } : { minWidth: "9rem", maxWidth: "100%" }
      }
    >
      <label htmlFor={id}>Alerta</label>
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          id={id}
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
          title={selectedLabel}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-2 text-left text-sm text-foreground outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50",
          )}
        >
          <span className="min-w-0 truncate">{selectedLabel}</span>
          <span aria-hidden className="shrink-0 text-xs text-muted-foreground">
            ▾
          </span>
        </button>
        <AnchoredPortal
          open={open}
          anchorRef={triggerRef}
          onDismiss={() => setOpen(false)}
          className="flex flex-col overflow-hidden bg-surface p-0"
          maxHeight={280}
          overflowY="auto"
          matchAnchorWidth
        >
          <ul
            role="listbox"
            aria-label="Alerta"
            className="py-1"
          >
            <li role="option" aria-selected={value === "all"}>
              <button
                type="button"
                title={allLabel}
                className={cn(
                  "flex w-full items-center px-3 py-1.5 text-left text-sm transition-colors",
                  value === "all"
                    ? "bg-primary/10 font-medium text-foreground"
                    : "text-foreground hover:bg-muted",
                )}
                onClick={() => pick("all")}
              >
                <span className="min-w-0 truncate">{allLabel}</span>
              </button>
            </li>
            {options.map((opt) => {
              const selected = value === opt.id;
              return (
                <li key={opt.id} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    title={opt.name}
                    className={cn(
                      "flex w-full items-center px-3 py-1.5 text-left text-sm transition-colors",
                      selected
                        ? "bg-primary/10 font-medium text-foreground"
                        : "text-foreground hover:bg-muted",
                    )}
                    onClick={() => pick(opt.id)}
                  >
                    <span className="min-w-0 truncate">{opt.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </AnchoredPortal>
      </div>
    </div>
  );
}
