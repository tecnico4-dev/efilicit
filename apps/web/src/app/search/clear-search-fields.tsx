"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { CLEAR_SEARCH_EVENT, useSearchFeedback } from "./search-feedback";
import { isSearchFormPreviewing } from "./search-form-preview";
import { SEARCH_FORM_ID } from "./save-search-button";

const FIELD_NAMES = [
  "q",
  "cpv",
  "cpv_draft",
  "min",
  "max",
  "ccaa",
  "municipality",
  "status",
  "procedure",
  "contract_type",
  "pub_from",
  "pub_to",
  "en_plazo",
] as const;

function blankNamedFields(form: HTMLFormElement, name: string) {
  const el = form.elements.namedItem(name);
  if (el instanceof RadioNodeList) {
    for (const node of el) {
      if (node instanceof HTMLInputElement) {
        if (node.type === "checkbox" || node.type === "radio") {
          node.checked = false;
        } else {
          node.value = "";
        }
      }
    }
    return;
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
    if (el instanceof HTMLInputElement && el.type === "checkbox") {
      el.checked = false;
      return;
    }
    el.value = "";
    if (el instanceof HTMLSelectElement) {
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
}

function blankFormFields(form: HTMLFormElement) {
  for (const name of FIELD_NAMES) {
    blankNamedFields(form, name);
  }
  const munText = form.querySelector(
    "#municipality-text",
  ) as HTMLInputElement | null;
  if (munText) munText.value = "";
  window.dispatchEvent(new Event(CLEAR_SEARCH_EVENT));
}

function fieldHasValue(form: HTMLFormElement, name: string): boolean {
  const el = form.elements.namedItem(name);
  if (el instanceof RadioNodeList) {
    return [...el].some((node) => {
      if (!(node instanceof HTMLInputElement)) return false;
      if (node.type === "checkbox" || node.type === "radio") return node.checked;
      return node.value.trim() !== "";
    });
  }
  if (el instanceof HTMLInputElement && el.type === "checkbox") {
    return el.checked;
  }
  return (
    (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) &&
    el.value.trim() !== ""
  );
}

function formHasValues(form: HTMLFormElement): boolean {
  return FIELD_NAMES.some((name) => fieldHasValue(form, name));
}

/**
 * Solo vacía los inputs del formulario. No toca la URL ni los resultados.
 * Invisible (pero ocupa hueco) si no hay valores — evita saltos del botón Buscar.
 */
export function ClearSearchFieldsButton() {
  const { clearFeedback } = useSearchFeedback();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const form = document.getElementById(SEARCH_FORM_ID) as HTMLFormElement | null;
    if (!form) return;

    const sync = () => {
      if (isSearchFormPreviewing(form)) return;
      setVisible(formHasValues(form));
    };
    sync();
    form.addEventListener("input", sync);
    form.addEventListener("change", sync);
    return () => {
      form.removeEventListener("input", sync);
      form.removeEventListener("change", sync);
    };
  }, []);

  function onClear() {
    if (!visible) return;
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
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      disabled={!visible}
      className={cn(
        "text-xs text-muted-foreground hover:text-foreground hover:underline",
        !visible && "invisible pointer-events-none",
      )}
    >
      Limpiar campos
    </button>
  );
}
