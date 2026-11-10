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
  SEARCH_APPLY_CRITERIA_EVENT,
  SEARCH_PREVIEW_GHOST_CLASS,
  useOptionalSearchFormPreview,
} from "@/app/search/search-form-preview";
import { AnchoredPortal } from "@/components/ui/anchored-portal";
import type { SearchCriteria } from "@efilicit/types";

const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"] as const;

type Props = {
  initialFrom?: string;
  initialTo?: string;
  /** Prefijo de ids (alertas). */
  idPrefix?: string;
  /** Etiqueta del control (default: Publicación). */
  label?: string;
  /**
   * Modo controlado (p. ej. modal de alertas): sin inputs hidden ni eventos de form.
   * Si se pasa `onChange`, el valor efectivo es `from`/`to` (o vacío).
   */
  from?: string;
  to?: string;
  onChange?: (nextFrom: string, nextTo: string) => void;
  /** Ítems extra al inicio del menú (p. ej. «Último envío»). */
  leadingMenuItems?: { label: string; onSelect: () => void }[];
  /** Sustituye el resumen del botón (p. ej. «Último envío»). */
  summaryOverride?: string | null;
  /**
   * Atajos del menú (tras leadingMenuItems).
   * Default buscador: últimos 7 días / este mes / este año.
   */
  presets?: Array<"thisWeek" | "last7" | "thisMonth" | "thisYear">;
};

const DEFAULT_PRESETS: Array<"thisWeek" | "last7" | "thisMonth" | "thisYear"> =
  ["last7", "thisMonth", "thisYear"];

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

/** Lunes de la semana ISO-local (Lu–Do) que contiene `d`. */
function startOfWeekMonday(d: Date): Date {
  const x = startOfDay(d);
  const mondayIndex = (x.getDay() + 6) % 7;
  return addDays(x, -mondayIndex);
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
  label = "Publicación",
  from: controlledFrom,
  to: controlledTo,
  onChange,
  leadingMenuItems,
  summaryOverride = null,
  presets = DEFAULT_PRESETS,
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
  const isPreviewing = previewInitial != null && onChange == null;
  const isControlled = onChange != null;

  const [from, setFrom] = useState(
    isControlled ? (controlledFrom ?? "") : initialFrom,
  );
  const [to, setTo] = useState(
    isControlled ? (controlledTo ?? "") : initialTo,
  );
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

  useEffect(() => {
    if (!isControlled) return;
    setFrom(controlledFrom ?? "");
    setTo(controlledTo ?? "");
  }, [isControlled, controlledFrom, controlledTo]);

  const displayFrom = isPreviewing
    ? previewInitial!.pubFrom
    : isControlled
      ? (controlledFrom ?? "")
      : from;
  const displayTo = isPreviewing
    ? previewInitial!.pubTo
    : isControlled
      ? (controlledTo ?? "")
      : to;
  const pickingEnabled = pickInicio || pickFin;

  useEffect(() => {
    if (isControlled) return;
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
  }, [isControlled]);

  useEffect(() => {
    if (isControlled) return;
    function onApply(e: Event) {
      const criteria = (e as CustomEvent<SearchCriteria>).detail;
      if (!criteria) return;
      const initial = criteriaToFilterInitial(criteria);
      setFrom(initial.pubFrom);
      setTo(initial.pubTo);
      setDraftStart(null);
      setHoverDay(null);
      setPickInicio(true);
      setPickFin(true);
      setPanel("menu");
      setOpen(false);
      const anchor =
        parseIso(initial.pubFrom) ?? parseIso(initial.pubTo) ?? today();
      setViewMonth(startOfMonth(anchor));
    }
    window.addEventListener(SEARCH_APPLY_CRITERIA_EVENT, onApply);
    return () => window.removeEventListener(SEARCH_APPLY_CRITERIA_EVENT, onApply);
  }, [isControlled]);

  useEffect(() => {
    if (isPreviewing || isControlled) return;
    const form = wrapRef.current?.closest("form");
    if (!form) return;
    form.dispatchEvent(new Event("input", { bubbles: true }));
    form.dispatchEvent(new Event("change", { bubbles: true }));
  }, [from, to, isPreviewing, isControlled]);

  /** Si solo Inicio o solo Fin está activo, vacía el extremo que no se está eligiendo. */
  function clearInactiveBound(nextInicio: boolean, nextFin: boolean) {
    if (nextInicio && !nextFin) {
      if (isControlled) onChange?.(displayFrom, "");
      else setTo("");
    } else if (nextFin && !nextInicio) {
      if (isControlled) onChange?.("", displayTo);
      else setFrom("");
    }
  }

  function leaveCalendar(closePopover: boolean) {
    clearInactiveBound(pickInicio, pickFin);
    setDraftStart(null);
    setHoverDay(null);
    setPanel("menu");
    if (closePopover) setOpen(false);
  }

  function dismissPopover() {
    if (panel === "calendar") {
      leaveCalendar(true);
    } else {
      setOpen(false);
      setPanel("menu");
      setDraftStart(null);
      setHoverDay(null);
    }
  }

  function applyRange(nextFrom: string, nextTo: string) {
    clearFeedback();
    if (isControlled) {
      onChange?.(nextFrom, nextTo);
    } else {
      setFrom(nextFrom);
      setTo(nextTo);
    }
    setDraftStart(null);
    setHoverDay(null);
    setOpen(false);
    setPanel("menu");
  }

  function onPresetThisWeek() {
    const end = today();
    applyRange(toIso(startOfWeekMonday(end)), toIso(end));
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

  const presetItems: {
    key: "thisWeek" | "last7" | "thisMonth" | "thisYear";
    label: string;
    onClick: () => void;
  }[] = [
    { key: "thisWeek", label: "Esta semana", onClick: onPresetThisWeek },
    { key: "last7", label: "Últimos 7 días", onClick: onPresetLast7 },
    { key: "thisMonth", label: "Este mes", onClick: onPresetThisMonth },
    { key: "thisYear", label: "Este año", onClick: onPresetThisYear },
  ];
  const visiblePresets = presetItems.filter((p) => presets.includes(p.key));

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
  const triggerRef = useRef<HTMLButtonElement>(null);

  const summary =
    summaryOverride?.trim() || summaryLabel(displayFrom, displayTo);

  return (
    <div
      ref={wrapRef}
      className={cn(
        "relative",
        // Modal alertas: ancho justo para «dd/mm/aaaa – dd/mm/aaaa»; buscador: full.
        isControlled ? "w-[13.75rem] shrink-0" : "w-full",
      )}
    >
      <label
        htmlFor={triggerId}
        className={cn(
          "block font-medium",
          isControlled
            ? "text-xs text-muted-foreground"
            : "text-sm text-foreground",
        )}
      >
        {label}
      </label>
      {!isControlled ? (
        <>
          <input type="hidden" name="pub_from" value={from} />
          <input type="hidden" name="pub_to" value={to} />
        </>
      ) : null}
      <button
        ref={triggerRef}
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
          // En filtros controlados (alertas) «Cualquier fecha» = mismo peso que «Todas».
          // En buscador, vacío sigue en muted como placeholder.
          isControlled || displayFrom || displayTo || summaryOverride
            ? "text-foreground"
            : "text-muted-foreground",
          isPreviewing && SEARCH_PREVIEW_GHOST_CLASS,
        )}
      >
        <span className="min-w-0 truncate">{summary}</span>
        <ChevronDown />
      </button>

      <AnchoredPortal
        open={open && !isPreviewing}
        anchorRef={triggerRef}
        onDismiss={dismissPopover}
        matchAnchorWidth={false}
        minWidth={288}
        maxWidth={320}
        maxHeight={420}
        className="bg-background p-2"
      >
        <div role="dialog" aria-label={label}>
          {panel === "menu" ? (
            <ul className="py-0.5">
              {(leadingMenuItems ?? []).map((item) => (
                <MenuItem
                  key={item.label}
                  onClick={() => {
                    item.onSelect();
                    setOpen(false);
                    setPanel("menu");
                  }}
                >
                  {item.label}
                </MenuItem>
              ))}
              {visiblePresets.map((p) => (
                <MenuItem key={p.key} onClick={p.onClick}>
                  {p.label}
                </MenuItem>
              ))}
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
      </AnchoredPortal>
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
