"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CLEAR_SEARCH_EVENT } from "@/app/search/search-feedback";
import {
  SEARCH_APPLY_CRITERIA_EVENT,
  SEARCH_PREVIEW_GHOST_CLASS,
  SEARCH_PREVIEW_MULTI_EVENT,
  SEARCH_RESTORE_MULTI_EVENT,
  type SearchPreviewMultiDetail,
} from "@/app/search/search-form-preview";
import { criteriaToFilterInitial } from "@/lib/criteria-display";
import { cn } from "@/lib/cn";
import type { SearchFilterOption } from "@/lib/queries";
import type { SearchCriteria } from "@efilicit/types";

/**
 * Desplegable multi-valor con ticks (Estado / Procedimiento / Tipo).
 * Sin selección = «Todos» (no envía params). Con ticks = OR en la RPC.
 */
export function CriteriaMultiSelect({
  id,
  name,
  label,
  options,
  initialSelected,
}: {
  id: string;
  name: string;
  label: string;
  options: SearchFilterOption[];
  initialSelected: string[];
}) {
  const initialKey = initialSelected.join("\u0001");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(() =>
    uniquePreserve(initialSelected),
  );
  const [previewing, setPreviewing] = useState(false);
  const snapshotRef = useRef<string[] | null>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelected(uniquePreserve(initialSelected));
    snapshotRef.current = null;
    setPreviewing(false);
    // initialKey evita resets por nueva referencia de array con mismo contenido.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync by key
  }, [initialKey]);

  useEffect(() => {
    function onClear() {
      setSelected([]);
      setOpen(false);
      snapshotRef.current = null;
      setPreviewing(false);
    }
    window.addEventListener(CLEAR_SEARCH_EVENT, onClear);
    return () => window.removeEventListener(CLEAR_SEARCH_EVENT, onClear);
  }, []);

  useEffect(() => {
    function valuesFromCriteria(criteria: SearchCriteria): string[] {
      const initial = criteriaToFilterInitial(criteria);
      if (name === "status") return initial.statuses;
      if (name === "procedure") return initial.procedureTypes;
      if (name === "contract_type") return initial.contractTypes;
      return [];
    }

    function onPreview(e: Event) {
      const detail = (e as CustomEvent<SearchPreviewMultiDetail>).detail;
      if (!detail || !(name in detail)) return;
      const values = detail[name as keyof SearchPreviewMultiDetail] ?? [];
      if (snapshotRef.current == null) {
        snapshotRef.current = selectedRef.current;
      }
      setSelected(uniquePreserve(values));
      setPreviewing(true);
    }
    function onRestore() {
      if (snapshotRef.current != null) {
        setSelected(snapshotRef.current);
        snapshotRef.current = null;
      }
      setPreviewing(false);
    }
    function onApply(e: Event) {
      const criteria = (e as CustomEvent<SearchCriteria>).detail;
      if (!criteria) return;
      snapshotRef.current = null;
      setSelected(uniquePreserve(valuesFromCriteria(criteria)));
      setPreviewing(false);
      setOpen(false);
    }
    window.addEventListener(SEARCH_PREVIEW_MULTI_EVENT, onPreview);
    window.addEventListener(SEARCH_RESTORE_MULTI_EVENT, onRestore);
    window.addEventListener(SEARCH_APPLY_CRITERIA_EVENT, onApply);
    return () => {
      window.removeEventListener(SEARCH_PREVIEW_MULTI_EVENT, onPreview);
      window.removeEventListener(SEARCH_RESTORE_MULTI_EVENT, onRestore);
      window.removeEventListener(SEARCH_APPLY_CRITERIA_EVENT, onApply);
    };
  }, [name]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const labelByValue = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of options) m.set(o.value, o.label);
    return m;
  }, [options]);

  const summary =
    selected.length === 0
      ? "Todos"
      : selected.length <= 2
        ? selected.map((v) => labelByValue.get(v) ?? v).join(", ")
        : `${selected.length} seleccionados`;

  function toggle(value: string) {
    setSelected((prev) => {
      if (prev.includes(value)) return prev.filter((v) => v !== value);
      return [...prev, value];
    });
  }

  return (
    <div ref={rootRef}>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative mt-1">
        <button
          type="button"
          id={id}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-left text-sm text-foreground outline-none hover:bg-muted/40 focus:ring-2 focus:ring-ring",
            previewing && SEARCH_PREVIEW_GHOST_CLASS,
          )}
        >
          <span className="min-w-0 truncate">{summary}</span>
          <span aria-hidden className="shrink-0 text-xs text-muted-foreground">
            ▾
          </span>
        </button>
        {selected.map((value) => (
          <input key={value} type="hidden" name={name} value={value} />
        ))}
        {open ? (
          <ul
            role="listbox"
            aria-multiselectable
            className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-lg"
          >
            <li className="border-b border-border px-3 py-1.5">
              <button
                type="button"
                className="w-full text-left text-xs font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setSelected([])}
              >
                Todos (limpiar selección)
              </button>
            </li>
            {options.map((opt) => {
              const checked = selected.includes(opt.value);
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
        ) : null}
      </div>
    </div>
  );
}

function uniquePreserve(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const t = v.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}
