"use client";

import { useEffect, useState } from "react";
import { useSearchFeedback } from "./search-feedback";
import { SEARCH_FORM_ID } from "./save-search-button";

const FIELD_NAMES = ["q", "cpv", "min", "max", "ccaa"] as const;

function blankFormFields(form: HTMLFormElement) {
  for (const name of FIELD_NAMES) {
    const el = form.elements.namedItem(name);
    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
      el.value = "";
    }
  }
}

function formHasValues(form: HTMLFormElement): boolean {
  return FIELD_NAMES.some((name) => {
    const el = form.elements.namedItem(name);
    return (
      (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) &&
      el.value.trim() !== ""
    );
  });
}

/**
 * Solo vacía los inputs del formulario. No toca la URL ni los resultados.
 * Visible únicamente si algún campo tiene valor.
 */
export function ClearSearchFieldsButton() {
  const { clearFeedback } = useSearchFeedback();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const form = document.getElementById(SEARCH_FORM_ID) as HTMLFormElement | null;
    if (!form) return;

    const sync = () => setVisible(formHasValues(form));
    sync();
    form.addEventListener("input", sync);
    form.addEventListener("change", sync);
    return () => {
      form.removeEventListener("input", sync);
      form.removeEventListener("change", sync);
    };
  }, []);

  if (!visible) return null;

  function onClear() {
    clearFeedback();
    const form = document.getElementById(SEARCH_FORM_ID) as HTMLFormElement | null;
    if (form && formHasValues(form)) {
      blankFormFields(form);
      setVisible(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClear}
      className="text-xs text-muted-foreground hover:text-foreground hover:underline"
    >
      Limpiar campos
    </button>
  );
}
