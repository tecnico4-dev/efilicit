"use client";

import { useMemo, useRef, useState } from "react";
import { AnchoredPortal } from "@/components/ui/anchored-portal";
import { cn } from "@/lib/cn";

const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"] as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseIso(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, day] = iso.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  if (d.getFullYear() !== y || d.getMonth() !== m - 1 || d.getDate() !== day) {
    return null;
  }
  return d;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() + n);
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function monthLabel(d: Date): string {
  const raw = d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function buildMonthCells(viewMonth: Date): { date: Date; outside: boolean }[] {
  const first = startOfMonth(viewMonth);
  const mondayIndex = (first.getDay() + 6) % 7;
  const gridStart = addDays(first, -mondayIndex);
  const cells: { date: Date; outside: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const date = addDays(gridStart, i);
    cells.push({
      date,
      outside: date.getMonth() !== viewMonth.getMonth(),
    });
  }
  return cells;
}

function formatEs(iso: string): string {
  const d = parseIso(iso);
  if (!d) return iso;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Calendario de una sola fecha, estética del buscador «Personalizado». */
export function SingleDatePicker({
  value,
  disabled,
  locked,
  readOnly,
  alignStart,
  boxed,
  placeholder = "—",
  className,
  toneClassName,
  onChange,
}: {
  /** YYYY-MM-DD o null */
  value: string | null;
  disabled?: boolean;
  /** Solo lectura (p. ej. fila en «No aplica»). */
  locked?: boolean;
  /** Vista: misma estética, sin abrir calendario. */
  readOnly?: boolean;
  alignStart?: boolean;
  /** Trigger con borde/ancho de campo (formularios / modales). */
  boxed?: boolean;
  placeholder?: string;
  className?: string;
  toneClassName?: string;
  onChange: (next: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [viewMonth, setViewMonth] = useState(() =>
    startOfMonth(parseIso(value ?? "") ?? new Date()),
  );
  const cells = useMemo(() => buildMonthCells(viewMonth), [viewMonth]);
  const inert = Boolean(disabled || locked || readOnly);

  return (
    <div
      className={cn(
        "relative",
        boxed ? "block w-full" : "inline-flex",
        !boxed && (alignStart ? "justify-start" : "justify-center"),
        className,
      )}
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={Boolean(disabled || locked)}
        aria-disabled={inert}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          if (inert) return;
          setViewMonth(startOfMonth(parseIso(value ?? "") ?? new Date()));
          setOpen((v) => !v);
        }}
        className={cn(
          "outline-none",
          boxed
            ? cn(
                "mt-1 flex w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-left text-sm",
                "hover:bg-muted/40 focus:ring-2 focus:ring-ring disabled:opacity-50",
                value ? "text-foreground" : "text-muted-foreground",
              )
            : cn(
                "rounded-sm text-xs font-medium",
                "focus-visible:ring-2 focus-visible:ring-primary/40",
                locked
                  ? "cursor-default text-muted-foreground/45"
                  : cn(
                      readOnly
                        ? "cursor-default"
                        : "cursor-pointer hover:underline",
                      disabled && "cursor-wait opacity-60 no-underline",
                      value ? toneClassName : "text-muted-foreground",
                    ),
              ),
        )}
      >
        <span className={boxed ? "min-w-0 truncate" : undefined}>
          {value ? formatEs(value) : placeholder}
        </span>
        {boxed ? (
          <span aria-hidden className="shrink-0 text-xs text-muted-foreground">
            ▾
          </span>
        ) : null}
      </button>

      <AnchoredPortal
        open={open && !inert}
        anchorRef={triggerRef}
        onDismiss={() => setOpen(false)}
        matchAnchorWidth={false}
        align="center"
        minWidth={288}
        maxWidth={320}
        maxHeight={380}
        className="bg-background p-2"
      >
        <div role="dialog" aria-label="Elegir fecha" className="space-y-2 p-1">
          <div className="flex items-center justify-between gap-2">
            <IconButton
              label="Mes anterior"
              onClick={() =>
                setViewMonth(
                  new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1),
                )
              }
            >
              ‹
            </IconButton>
            <p className="min-w-[9.5rem] text-center text-sm font-medium text-foreground">
              {monthLabel(viewMonth)}
            </p>
            <IconButton
              label="Mes siguiente"
              onClick={() =>
                setViewMonth(
                  new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1),
                )
              }
            >
              ›
            </IconButton>
          </div>

          <div className="grid grid-cols-7 gap-y-0.5 text-center">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="py-1 text-xs font-semibold text-foreground"
              >
                {d}
              </div>
            ))}
            {cells.map((cell) => {
              const iso = toIso(cell.date);
              const selected = value === iso;
              return (
                <button
                  key={iso + (cell.outside ? "-o" : "")}
                  type="button"
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                  className={cn(
                    "relative h-9 text-sm tabular-nums transition-colors hover:bg-primary/10",
                    cell.outside
                      ? "text-muted-foreground/50"
                      : "text-foreground",
                    selected &&
                      "rounded-md bg-primary text-primary-foreground hover:bg-primary",
                  )}
                >
                  {cell.date.getDate()}
                </button>
              );
            })}
          </div>

          {value ? (
            <button
              type="button"
              className="w-full rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              Quitar fecha
            </button>
          ) : null}
        </div>
      </AnchoredPortal>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-7 items-center justify-center rounded-md text-base text-foreground hover:bg-muted disabled:opacity-35"
    >
      {children}
    </button>
  );
}
