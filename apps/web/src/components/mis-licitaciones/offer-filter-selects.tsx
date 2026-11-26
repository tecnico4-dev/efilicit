"use client";

import { useMemo, useRef, useState } from "react";
import { AnchoredPortal } from "@/components/ui/anchored-portal";
import { cn } from "@/lib/cn";

/**
 * Desplegable multi-valor (estilo Criteria / filtros Requisitos).
 * `selected` vacío en el padre = «Todas» (sin filtrar).
 * «Limpiar» vacía casillas; si cierras con 0 ticks, se restaura lo anterior.
 */
export function FilterMultiSelect({
  id,
  label,
  options,
  selected,
  onChange,
  allLabel = "Todas",
}: {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  allLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const allValues = useMemo(() => options.map((o) => o.value), [options]);
  const labelByValue = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of options) m.set(o.value, o.label);
    return m;
  }, [options]);

  /** Selección en UI mientras el menú está abierto (puede ser []). */
  const [draft, setDraft] = useState<string[]>([]);

  function toUiSelection(values: string[]): string[] {
    return values.length === 0 ? [...allValues] : [...values];
  }

  function commitFromUi(ui: string[]) {
    if (ui.length === 0 || ui.length === allValues.length) {
      onChange([]);
      return;
    }
    onChange(ui);
  }

  function openMenu() {
    setDraft(toUiSelection(selected));
    setOpen(true);
  }

  function closeMenu() {
    // Limpiar + cerrar (0 casillas) → se mantiene lo que había en el modal.
    if (draft.length > 0) {
      commitFromUi(draft);
    }
    setOpen(false);
  }

  const isAll = open
    ? draft.length === allValues.length && allValues.length > 0
    : selected.length === 0;
  const uiSelected = open ? draft : toUiSelection(selected);

  const summary =
    selected.length === 0
      ? allLabel
      : selected.length <= 2
        ? selected.map((v) => labelByValue.get(v) ?? v).join(", ")
        : `${selected.length} seleccionados`;

  function toggle(value: string) {
    setDraft((prev) => {
      if (prev.includes(value)) return prev.filter((v) => v !== value);
      return [...prev, value];
    });
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative mt-1">
        <button
          ref={triggerRef}
          type="button"
          id={id}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => (open ? closeMenu() : openMenu())}
          className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-left text-sm text-foreground outline-none hover:bg-muted/40 focus:ring-2 focus:ring-ring"
        >
          <span className="min-w-0 truncate">{summary}</span>
          <span aria-hidden className="shrink-0 text-xs text-muted-foreground">
            ▾
          </span>
        </button>
        <AnchoredPortal
          open={open}
          anchorRef={triggerRef}
          onDismiss={closeMenu}
          className="flex flex-col overflow-hidden bg-surface p-0"
          maxHeight={224}
          overflowY="hidden"
        >
          <div className="flex shrink-0 border-b border-border bg-surface">
            <button
              type="button"
              className={cn(
                "flex-1 px-3 py-1.5 text-left text-xs font-medium transition-colors",
                isAll
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              onClick={() => setDraft([...allValues])}
            >
              {allLabel}
            </button>
            <button
              type="button"
              className="flex-1 border-l border-border px-3 py-1.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => setDraft([])}
            >
              Limpiar
            </button>
          </div>
          <ul
            role="listbox"
            aria-multiselectable
            className="min-h-0 flex-1 overflow-y-auto py-1"
          >
            {options.map((opt) => {
              const checked = uiSelected.includes(opt.value);
              return (
                <li key={opt.value} role="option" aria-selected={checked}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted">
                    <input
                      type="checkbox"
                      className="ef-checkbox"
                      checked={checked}
                      onChange={() => toggle(opt.value)}
                    />
                    <span className="min-w-0 truncate">{opt.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </AnchoredPortal>
      </div>
    </div>
  );
}

export function FilterSingleSelect({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const summary =
    options.find((o) => o.value === value)?.label ?? "Todas";

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative mt-1">
        <button
          ref={triggerRef}
          type="button"
          id={id}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-left text-sm text-foreground outline-none hover:bg-muted/40 focus:ring-2 focus:ring-ring"
        >
          <span className="min-w-0 truncate">{summary}</span>
          <span aria-hidden className="shrink-0 text-xs text-muted-foreground">
            ▾
          </span>
        </button>
        <AnchoredPortal
          open={open}
          anchorRef={triggerRef}
          onDismiss={() => setOpen(false)}
          className="bg-surface p-1"
          maxHeight={220}
        >
          <ul role="listbox" className="py-0.5">
            {options.map((opt) => (
              <li key={opt.value || "all"}>
                <button
                  type="button"
                  role="option"
                  aria-selected={opt.value === value}
                  className={cn(
                    "flex w-full rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-muted",
                    opt.value === value
                      ? "font-semibold text-foreground"
                      : "text-foreground",
                  )}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>
        </AnchoredPortal>
      </div>
    </div>
  );
}
