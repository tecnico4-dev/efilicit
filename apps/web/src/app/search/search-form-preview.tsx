"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { SearchCriteria } from "@efilicit/types";
import { criteriaToFilterInitial } from "@/lib/criteria-display";

/** Debe coincidir con `SEARCH_FORM_ID` (evita import circular con save-search). */
const FORM_ID = "search-form";

/** Clase fantasma en campos mientras dura el hover de una reciente. */
export const SEARCH_PREVIEW_GHOST_CLASS = "text-muted-foreground";

const SIMPLE_FIELD_NAMES = [
  "q",
  "min",
  "max",
  "ccaa",
  "status",
  "procedure",
  "contract_type",
  "pub_from",
  "pub_to",
  "en_plazo",
] as const;

type SimpleFieldName = (typeof SIMPLE_FIELD_NAMES)[number];

type FieldSnapshot = {
  name: SimpleFieldName;
  value: string;
  checked: boolean;
};

type SearchFormPreviewApi = {
  preview: SearchCriteria | null;
  setPreview: (criteria: SearchCriteria) => void;
  /** Limpia al momento (quitar chip, focus, etc.). */
  clearPreview: () => void;
  /**
   * Limpia tras un delay; se cancela si entra otra chip (`setPreview`).
   * Evita el parpadeo form-real entre burbujas.
   */
  scheduleClearPreview: (delayMs?: number) => void;
};

const SearchFormPreviewContext = createContext<SearchFormPreviewApi | null>(
  null,
);

export function isSearchFormPreviewing(form: HTMLFormElement): boolean {
  return form.dataset.previewing === "1";
}

function setPreviewingFlag(form: HTMLFormElement, on: boolean) {
  if (on) form.dataset.previewing = "1";
  else delete form.dataset.previewing;
}

function resolveField(
  form: HTMLFormElement,
  name: SimpleFieldName,
): HTMLInputElement | HTMLSelectElement | null {
  const el = form.elements.namedItem(name);
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
    return el;
  }
  return null;
}

function takeSnapshot(form: HTMLFormElement): FieldSnapshot[] {
  return SIMPLE_FIELD_NAMES.map((name) => {
    const el = resolveField(form, name);
    if (!el) return { name, value: "", checked: false };
    if (el instanceof HTMLInputElement && el.type === "checkbox") {
      return { name, value: el.value, checked: el.checked };
    }
    return { name, value: el.value, checked: false };
  });
}

function applyGhost(el: HTMLElement, on: boolean) {
  el.classList.toggle(SEARCH_PREVIEW_GHOST_CLASS, on);
}

function paintSimpleFields(form: HTMLFormElement, criteria: SearchCriteria) {
  const initial = criteriaToFilterInitial(criteria);
  const values: Record<Exclude<SimpleFieldName, "en_plazo">, string> = {
    q: initial.q,
    min: initial.min,
    max: initial.max,
    ccaa: initial.ccaa,
    status: initial.status,
    procedure: initial.procedure,
    contract_type: initial.contractType,
    pub_from: initial.pubFrom,
    pub_to: initial.pubTo,
  };

  for (const name of SIMPLE_FIELD_NAMES) {
    const el = resolveField(form, name);
    if (!el) continue;
    if (name === "en_plazo") {
      if (el instanceof HTMLInputElement) {
        el.checked = initial.openForSubmission;
      }
    } else {
      el.value = values[name];
    }
    applyGhost(el, true);
  }
}

function restoreSimpleFields(form: HTMLFormElement, snapshot: FieldSnapshot[]) {
  for (const item of snapshot) {
    const el = resolveField(form, item.name);
    if (!el) continue;
    if (el instanceof HTMLInputElement && el.type === "checkbox") {
      el.checked = item.checked;
    } else {
      el.value = item.value;
    }
    applyGhost(el, false);
  }
}

const CLEAR_PREVIEW_DELAY_MS = 150;

export function SearchFormPreviewProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [preview, setPreviewState] = useState<SearchCriteria | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelScheduledClear = useCallback(() => {
    if (clearTimerRef.current == null) return;
    clearTimeout(clearTimerRef.current);
    clearTimerRef.current = null;
  }, []);

  const setPreview = useCallback(
    (criteria: SearchCriteria) => {
      cancelScheduledClear();
      setPreviewState(criteria);
    },
    [cancelScheduledClear],
  );

  const clearPreview = useCallback(() => {
    cancelScheduledClear();
    setPreviewState(null);
  }, [cancelScheduledClear]);

  const scheduleClearPreview = useCallback(
    (delayMs = CLEAR_PREVIEW_DELAY_MS) => {
      cancelScheduledClear();
      clearTimerRef.current = setTimeout(() => {
        clearTimerRef.current = null;
        setPreviewState(null);
      }, delayMs);
    },
    [cancelScheduledClear],
  );

  useEffect(() => () => cancelScheduledClear(), [cancelScheduledClear]);

  return (
    <SearchFormPreviewContext.Provider
      value={{ preview, setPreview, clearPreview, scheduleClearPreview }}
    >
      {children}
    </SearchFormPreviewContext.Provider>
  );
}

export function useSearchFormPreview(): SearchFormPreviewApi {
  const ctx = useContext(SearchFormPreviewContext);
  if (!ctx) {
    throw new Error(
      "useSearchFormPreview debe usarse dentro de SearchFormPreviewProvider",
    );
  }
  return ctx;
}

/** CPV / municipio / alertas: sin provider → null (no preview). */
export function useOptionalSearchFormPreview(): SearchFormPreviewApi | null {
  return useContext(SearchFormPreviewContext);
}

/**
 * Snapshot + pintura temporal de campos simples (sin input/change).
 * Montar dentro del `<form id="search-form">`.
 */
export function useSimpleFieldsPreview() {
  const { preview, clearPreview } = useSearchFormPreview();
  const snapshotRef = useRef<FieldSnapshot[] | null>(null);

  useEffect(() => {
    const form = document.getElementById(FORM_ID) as HTMLFormElement | null;
    if (!form) return;

    if (!preview) {
      if (snapshotRef.current) {
        restoreSimpleFields(form, snapshotRef.current);
        snapshotRef.current = null;
      }
      setPreviewingFlag(form, false);
      return;
    }

    if (!snapshotRef.current) {
      snapshotRef.current = takeSnapshot(form);
    }
    setPreviewingFlag(form, true);
    paintSimpleFields(form, preview);
  }, [preview]);

  useEffect(() => {
    const form = document.getElementById(FORM_ID) as HTMLFormElement | null;
    if (!form || !preview) return;

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (!form.contains(target)) return;
      clearPreview();
    };

    form.addEventListener("focusin", onFocusIn);
    return () => form.removeEventListener("focusin", onFocusIn);
  }, [preview, clearPreview]);

  useEffect(() => {
    return () => {
      const form = document.getElementById(FORM_ID) as HTMLFormElement | null;
      if (!form || !snapshotRef.current) return;
      restoreSimpleFields(form, snapshotRef.current);
      snapshotRef.current = null;
      setPreviewingFlag(form, false);
    };
  }, []);
}
