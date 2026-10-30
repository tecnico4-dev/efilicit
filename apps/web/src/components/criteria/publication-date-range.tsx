"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { criteriaToFilterInitial } from "@/lib/criteria-display";
import {
  CLEAR_SEARCH_EVENT,
  useOptionalSearchFeedback,
} from "@/app/search/search-feedback";
import {
  SEARCH_PREVIEW_GHOST_CLASS,
  useOptionalSearchFormPreview,
} from "@/app/search/search-form-preview";

const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"] as const;

type Props = {
  initialFrom?: string;
  initialTo?: string;
  /** Prefijo de ids (alertas). */
  idPrefix?: string;
};

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
  if (
    d.getFullYear() !== y ||
    d.getMonth() !== m - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }
  return d;
}

function formatEs(iso: string): string {
  const d = parseIso(iso);
  if (!d) return iso;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function today(): Date {
  return startOfDay(new Date());
}

function addDays(d: Date, n: number): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() + n);
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

function monthLabel(d: Date): string {
  const raw = d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function compareIso(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function summaryLabel(from: string, to: string): string {
  if (!from && !to) return "Cualquier fecha";
  if (from && to) return `${formatEs(from)} – ${formatEs(to)}`;
  if (from) return `Desde ${formatEs(from)}`;
  return `Hasta ${formatEs(to)}`;
}

type PanelMode = "menu" | "calendar";

/**
 * Un solo control de publicación: atajos + calendario de rango.
 * Emite `pub_from` / `pub_to` (YYYY-MM-DD) como hidden inputs.
 */
export function PublicationDateRange({
  initialFrom = "",
  initialTo = "",
  idPrefix = "",
}: Props) {
  const reactId = useId();
  const triggerId = `${idPrefix}pub_range-${reactId}`;
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchFeedback = useOptionalSearchFeedback();
  const clearFeedback = searchFeedback?.clearFeedback ?? (() => {});
  const formPreview = useOptionalSearchFormPreview();
  const previewInitial = formPreview?.preview
    ? criteriaToFilterInitial(formPreview.preview)
    : null;
  const isPreviewing = previewInitial != null;

  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<PanelMode>("menu");
  const [viewMonth, setViewMonth] = useState(() =>
    startOfMonth(parseIso(initialFrom) ?? parseIso(initialTo) ?? today()),
  );
  const [draftStart, setDraftStart] = useState<string | null>(null);
  const [hoverDay, setHoverDay] = useState<string | null>(null);
  /** Casillas Inicio/Fin: ambas = rango; una = solo ese extremo; ninguna = días bloqueados. */
  const [pickInicio, setPickInicio] = useState(true);
  const [pickFin, setPickFin] = useState(true);

  const displayFrom = isPreviewing ? previewInitial.pubFrom : from;
  const displayTo = isPreviewing ? previewInitial.pubTo : to;
  const pickingEnabled = pickInicio || pickFin;

  useEffect(() => {
    const onClear = () => {
      setFrom("");
      setTo("");
      setDraftStart(null);
      setHoverDay(null);
      setPickInicio(true);
      setPickFin(true);
      setPanel("menu");
      setOpen(false);
    };
    window.addEventListener(CLEAR_SEARCH_EVENT, onClear);
    return () => window.removeEventListener(CLEAR_SEARCH_EVENT, onClear);
  }, []);

  useEffect(() => {
    if (isPreviewing) return;
    const form = wrapRef.current?.closest("form");
    if (!form) return;
    form.dispatchEvent(new Event("input", { bubbles: true }));
    form.dispatchEvent(new Event("change", { bubbles: true }));
  }, [from, to, isPreviewing]);

  /** Si solo Inicio o solo Fin está activo, vacía el extremo que no se está eligiendo. */
  function clearInactiveBound(nextInicio: boolean, nextFin: boolean) {
    if (nextInicio && !nextFin) setTo("");
    else if (nextFin && !nextInicio) setFrom("");
  }

  function leaveCalendar(closePopover: boolean) {
    clearInactiveBound(pickInicio, pickFin);
    setDraftStart(null);
    setHoverDay(null);
    setPanel("menu");
    if (closePopover) setOpen(false);
  }

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        if (panel === "calendar") {
          leaveCalendar(true);
        } else {
          setOpen(false);
          setPanel("menu");
          setDraftStart(null);
          setHoverDay(null);
        }
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- leaveCalendar usa pickInicio/Fin/panel
  }, [panel, pickInicio, pickFin]);

  function applyRange(nextFrom: string, nextTo: string) {
    clearFeedback();
    setFrom(nextFrom);
    setTo(nextTo);
    setDraftStart(null);
    setHoverDay(null);
    setOpen(false);
    setPanel("menu");
  }

  function onPresetLast7() {
    const end = today();
    const start = addDays(end, -6);
    applyRange(toIso(start), toIso(end));
  }

  function onPresetThisMonth() {
    const end = today();
    applyRange(toIso(startOfMonth(end)), toIso(end));
  }

  function onPresetThisYear() {
    const end = today();
    applyRange(toIso(startOfYear(end)), toIso(end));
  }

  function onClear() {
    applyRange("", "");
  }

  function openCustom() {
    setPanel("calendar");
    setDraftStart(null);
    setHoverDay(null);
    setPickInicio(true);
    setPickFin(true);
    setViewMonth(
      startOfMonth(parseIso(from) ?? parseIso(to) ?? today()),
    );
  }

  function togglePickInicio() {
    setPickInicio((v) => !v);
    setDraftStart(null);
    setHoverDay(null);
  }

  function togglePickFin() {
    setPickFin((v) => !v);
    setDraftStart(null);
    setHoverDay(null);
  }

  function onPickDay(iso: string) {
    if (iso > toIso(today())) return;
    if (!pickingEnabled) return;

    if (pickInicio && pickFin) {
      if (!draftStart) {
        setDraftStart(iso);
        setHoverDay(null);
        return;
      }
      let a = draftStart;
      let b = iso;
      if (compareIso(a, b) > 0) [a, b] = [b, a];
      applyRange(a, b);
      return;
    }

    if (pickInicio) {
      // Solo inicio: la fecha fin no rellenada se borra.
      applyRange(iso, "");
      return;
    }

    // Solo fin: la fecha inicio no rellenada se borra.
    applyRange("", iso);
  }

  const rangeForPaint = useMemo(() => {
    if (panel === "calendar" && pickInicio && pickFin && draftStart) {
      const end = hoverDay ?? draftStart;
      return compareIso(draftStart, end) <= 0
        ? { start: draftStart, end }
        : { start: end, end: draftStart };
    }
    if (displayFrom && displayTo) {
      return { start: displayFrom, end: displayTo };
    }
    if (displayFrom) return { start: displayFrom, end: displayFrom };
    if (displayTo) return { start: displayTo, end: displayTo };
    return null;
  }, [
    panel,
    pickInicio,
    pickFin,
    draftStart,
    hoverDay,
    displayFrom,
    displayTo,
  ]);

  const cells = useMemo(() => buildMonthCells(viewMonth), [viewMonth]);

  return (
    <div ref={wrapRef} className="relative">
      <label
        htmlFor={triggerId}
        className="block text-sm font-medium text-foreground"
      >
        Publicación
      </label>
      <input type="hidden" name="pub_from" value={from} />
      <input type="hidden" name="pub_to" value={to} />
      <button
        id={triggerId}
        type="button"
        disabled={isPreviewing}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          if (isPreviewing) return;
          setOpen((v) => {
            const next = !v;
            if (!next) {
              if (panel === "calendar") {
                clearInactiveBound(pickInicio, pickFin);
              }
              setPanel("menu");
              setDraftStart(null);
              setHoverDay(null);
            } else {
              setPanel("menu");
            }
            return next;
          });
        }}
        className={cn(
          "mt-1 flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-left text-sm outline-none focus:ring-2 focus:ring-ring",
          !displayFrom && !displayTo
            ? "text-muted-foreground"
            : "text-foreground",
          isPreviewing && SEARCH_PREVIEW_GHOST_CLASS,
        )}
      >
        <span className="min-w-0 truncate">
          {summaryLabel(displayFrom, displayTo)}
        </span>
        <ChevronDown />
      </button>

      {open && !isPreviewing ? (
        <div
          role="dialog"
          aria-label="Rango de publicación"
          className="absolute z-30 mt-1 w-full min-w-[18rem] max-w-sm rounded-md border border-border bg-background p-2 shadow-md sm:w-[20rem]"
        >
          {panel === "menu" ? (
            <ul className="py-0.5">
              <MenuItem onClick={onPresetLast7}>Últimos 7 días</MenuItem>
              <MenuItem onClick={onPresetThisMonth}>Este mes</MenuItem>
              <MenuItem onClick={onPresetThisYear}>Este año</MenuItem>
              <MenuItem onClick={openCustom}>Personalizado</MenuItem>
              <MenuItem onClick={onClear} tone="muted">
                Borrar
              </MenuItem>
            </ul>
          ) : (
            <div className="space-y-2 p-1">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => leaveCalendar(false)}
                >
                  ← Opciones
                </button>
                <div className="flex items-center gap-1">
                  <IconButton
                    label="Mes anterior"
                    onClick={() =>
                      setViewMonth(
                        new Date(
                          viewMonth.getFullYear(),
                          viewMonth.getMonth() - 1,
                          1,
                        ),
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
                    disabled={
                      toIso(
                        new Date(
                          viewMonth.getFullYear(),
                          viewMonth.getMonth() + 1,
                          1,
                        ),
                      ) > toIso(today())
                    }
                    onClick={() =>
                      setViewMonth(
                        new Date(
                          viewMonth.getFullYear(),
                          viewMonth.getMonth() + 1,
                          1,
                        ),
                      )
                    }
                  >
                    ›
                  </IconButton>
                </div>
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
                  const future = iso > toIso(today());
                  const disabled = future || !pickingEnabled;
                  const outside = cell.outside;
                  const selected =
                    rangeForPaint != null &&
                    (iso === rangeForPaint.start || iso === rangeForPaint.end);
                  const inMiddle =
                    rangeForPaint != null &&
                    compareIso(iso, rangeForPaint.start) > 0 &&
                    compareIso(iso, rangeForPaint.end) < 0;
                  const isStart =
                    rangeForPaint != null && iso === rangeForPaint.start;
                  const isEnd =
                    rangeForPaint != null && iso === rangeForPaint.end;
                  const single =
                    rangeForPaint != null &&
                    rangeForPaint.start === rangeForPaint.end;

                  return (
                    <button
                      key={iso + (outside ? "-o" : "")}
                      type="button"
                      disabled={disabled}
                      onMouseEnter={() => {
                        if (
                          pickInicio &&
                          pickFin &&
                          draftStart &&
                          !disabled
                        ) {
                          setHoverDay(iso);
                        }
                      }}
                      onMouseLeave={() => setHoverDay(null)}
                      onClick={() => onPickDay(iso)}
                      className={cn(
                        "relative h-9 text-sm tabular-nums transition-colors",
                        disabled && "cursor-not-allowed opacity-35",
                        !pickingEnabled && "opacity-40",
                        !disabled && "hover:bg-primary/10",
                        outside && !selected && !inMiddle
                          ? "text-muted-foreground/50"
                          : "text-foreground",
                        inMiddle && "bg-primary/15",
                        selected && "bg-primary text-primary-foreground",
                        selected && single && "rounded-md",
                        selected && !single && isStart && "rounded-l-md",
                        selected && !single && isEnd && "rounded-r-md",
                        inMiddle && "rounded-none",
                      )}
                    >
                      {cell.date.getDate()}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 px-0.5 pt-1">
                <ModeChip
                  label="Inicio"
                  active={pickInicio}
                  value={from ? formatEs(from) : null}
                  onClick={togglePickInicio}
                />
                <ModeChip
                  label="Fin"
                  active={pickFin}
                  value={to ? formatEs(to) : null}
                  onClick={togglePickFin}
                />
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function buildMonthCells(viewMonth: Date): { date: Date; outside: boolean }[] {
  const first = startOfMonth(viewMonth);
  // Monday=0 … Sunday=6
  const mondayIndex = (first.getDay() + 6) % 7;
  const gridStart = addDays(first, -mondayIndex);
  const cells: { date: Date; outside: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const date = addDays(gridStart, i);
    cells.push({
      date,
      outside:
        date.getMonth() !== viewMonth.getMonth() ||
        date.getFullYear() !== viewMonth.getFullYear(),
    });
  }
  return cells;
}

function ModeChip({
  label,
  active,
  value,
  onClick,
}: {
  label: string;
  active: boolean;
  value: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-1 flex-col items-start rounded-md border px-2.5 py-1.5 text-left transition-colors",
        active
          ? "border-primary/50 bg-primary/10 text-foreground"
          : "border-border bg-muted/30 text-muted-foreground",
      )}
    >
      <span className="text-xs font-semibold">{label}</span>
      <span className="w-full truncate text-[11px] tabular-nums opacity-80">
        {value ?? "—"}
      </span>
    </button>
  );
}

function MenuItem({
  children,
  onClick,
  tone = "default",
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: "default" | "muted";
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
          tone === "muted" ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {children}
      </button>
    </li>
  );
}

function IconButton({
  children,
  label,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md text-base text-muted-foreground hover:bg-muted hover:text-foreground",
        disabled && "cursor-not-allowed opacity-35 hover:bg-transparent",
      )}
    >
      {children}
    </button>
  );
}

function ChevronDown() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0 text-muted-foreground"
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}
