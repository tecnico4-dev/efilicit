"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CLEAR_SEARCH_EVENT } from "@/app/search/search-feedback";
import {
  SEARCH_APPLY_CRITERIA_EVENT,
  SEARCH_CCAA_MENU_OPEN_EVENT,
  SEARCH_CCAA_SELECTION_EVENT,
  SEARCH_CCAA_SET_EVENT,
  SEARCH_PREVIEW_GHOST_CLASS,
  SEARCH_PREVIEW_MULTI_EVENT,
  SEARCH_RESTORE_MULTI_EVENT,
  type SearchCcaaSelectionDetail,
  type SearchCcaaSetDetail,
  type SearchPreviewMultiDetail,
} from "@/app/search/search-form-preview";
import { AnchoredPortal } from "@/components/ui/anchored-portal";
import { criteriaToFilterInitial } from "@/lib/criteria-display";
import { cn } from "@/lib/cn";
import type { SearchFilterOption } from "@/lib/queries";
import type { SearchCriteria } from "@efilicit/types";

/**
 * Desplegable multi-valor con ticks (Estado / Procedimiento / Tipo / CCAA).
 * «Todos» = todas marcadas (no envía params). Parcial = OR en la RPC.
 * «Limpiar» deja 0 ticks; al cerrar sin selección se restaura lo anterior.
 */
export function CriteriaMultiSelect({
  id,
  name,
  label,
  options,
  initialSelected,
  allLabel = "Todos",
  noneLabel = "Ninguno",
}: {
  id: string;
  name: string;
  label: string;
  options: SearchFilterOption[];
  initialSelected: string[];
  allLabel?: string;
  noneLabel?: string;
}) {
  const allValues = useMemo(
    () => options.map((o) => o.value),
    [options],
  );
  const allKey = allValues.join("\u0001");
  const initialKey = `${initialSelected.join("\u0001")}|${allKey}`;

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(() =>
    toUiSelection(initialSelected, allValues),
  );
  const [previewing, setPreviewing] = useState(false);
  const snapshotRef = useRef<string[] | null>(null);
  const openSnapshotRef = useRef<string[]>([]);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setSelected(toUiSelection(initialSelected, allValues));
    snapshotRef.current = null;
    setPreviewing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync by key
  }, [initialKey]);

  useEffect(() => {
    function onClear() {
      setSelected([...allValues]);
      setOpen(false);
      snapshotRef.current = null;
      setPreviewing(false);
    }
    window.addEventListener(CLEAR_SEARCH_EVENT, onClear);
    return () => window.removeEventListener(CLEAR_SEARCH_EVENT, onClear);
  }, [allValues]);

  useEffect(() => {
    function valuesFromCriteria(criteria: SearchCriteria): string[] {
      const initial = criteriaToFilterInitial(criteria);
      if (name === "status") return initial.statuses;
      if (name === "procedure") return initial.procedureTypes;
      if (name === "contract_type") return initial.contractTypes;
      if (name === "ccaa") return initial.ccaaCodes;
      return [];
    }

    function onPreview(e: Event) {
      const detail = (e as CustomEvent<SearchPreviewMultiDetail>).detail;
      if (!detail || !(name in detail)) return;
      const values = detail[name as keyof SearchPreviewMultiDetail] ?? [];
      if (snapshotRef.current == null) {
        snapshotRef.current = selectedRef.current;
      }
      setSelected(toUiSelection(values, allValues));
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
      setSelected(toUiSelection(valuesFromCriteria(criteria), allValues));
      setPreviewing(false);
      setOpen(false);
    }
    function onCcaaSet(e: Event) {
      if (name !== "ccaa") return;
      const detail = (e as CustomEvent<SearchCcaaSetDetail>).detail;
      if (!detail) return;
      const next = toUiSelection(detail.codes, allValues);
      selectedRef.current = next;
      setSelected(next);
      setPreviewing(false);
    }
    window.addEventListener(SEARCH_PREVIEW_MULTI_EVENT, onPreview);
    window.addEventListener(SEARCH_RESTORE_MULTI_EVENT, onRestore);
    window.addEventListener(SEARCH_APPLY_CRITERIA_EVENT, onApply);
    window.addEventListener(SEARCH_CCAA_SET_EVENT, onCcaaSet);
    return () => {
      window.removeEventListener(SEARCH_PREVIEW_MULTI_EVENT, onPreview);
      window.removeEventListener(SEARCH_RESTORE_MULTI_EVENT, onRestore);
      window.removeEventListener(SEARCH_APPLY_CRITERIA_EVENT, onApply);
      window.removeEventListener(SEARCH_CCAA_SET_EVENT, onCcaaSet);
    };
  }, [name, allValues]);

  useEffect(() => {
    const form = triggerRef.current?.closest("form");
    if (form) {
      form.dispatchEvent(new Event("input", { bubbles: true }));
      form.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (name === "ccaa") {
      window.dispatchEvent(
        new CustomEvent<SearchCcaaSelectionDetail>(SEARCH_CCAA_SELECTION_EVENT, {
          detail: { codes: selected },
        }),
      );
    }
  }, [name, selected]);

  const labelByValue = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of options) m.set(o.value, o.label);
    return m;
  }, [options]);

  const isAll =
    allValues.length > 0 && allValues.every((v) => selected.includes(v));

  const formValues = isAll || selected.length === 0 ? [] : selected;

  const summary = isAll
    ? allLabel
    : selected.length === 0
      ? noneLabel
      : selected.length <= 2
        ? selected.map((v) => labelByValue.get(v) ?? v).join(", ")
        : `${selected.length} seleccionados`;

  function openMenu() {
    if (name === "ccaa") {
      // Sync: municipio puede restaurar CCAA previas y limpiarse.
      window.dispatchEvent(new Event(SEARCH_CCAA_MENU_OPEN_EVENT));
    }
    openSnapshotRef.current = [...selectedRef.current];
    setOpen(true);
  }

  function closeMenu() {
    setSelected((prev) => {
      if (prev.length > 0) return prev;
      const snap = openSnapshotRef.current;
      if (snap.length > 0) return snap;
      return [...allValues];
    });
    setOpen(false);
  }

  function toggle(value: string) {
    setSelected((prev) => {
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
        {formValues.map((value) => (
          <input key={value} type="hidden" name={name} value={value} />
        ))}
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
              onClick={() => setSelected([...allValues])}
            >
              {allLabel}
            </button>
            <button
              type="button"
              className="flex-1 border-l border-border px-3 py-1.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => setSelected([])}
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
        </AnchoredPortal>
      </div>
    </div>
  );
}

/** Vacío / sin filtro en criteria → UI «Todos» (todas marcadas). */
function toUiSelection(values: string[], allValues: string[]): string[] {
  const cleaned = uniquePreserve(values);
  if (cleaned.length === 0) return [...allValues];
  return cleaned;
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
