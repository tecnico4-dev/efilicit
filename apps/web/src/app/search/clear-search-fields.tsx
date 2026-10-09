"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useSearchFeedback } from "./search-feedback";
import { SEARCH_FORM_ID } from "./save-search-button";

const FIELD_NAMES = ["q", "cpv", "min", "max"] as const;

function urlHasSearchParams(params: URLSearchParams): boolean {
  return FIELD_NAMES.some((name) => (params.get(name) ?? "").trim() !== "");
}

function blankFormFields(form: HTMLFormElement) {
  for (const name of FIELD_NAMES) {
    const el = form.elements.namedItem(name);
    if (el instanceof HTMLInputElement) el.value = "";
  }
}

function formHasValues(form: HTMLFormElement): boolean {
  return FIELD_NAMES.some((name) => {
    const el = form.elements.namedItem(name);
    return el instanceof HTMLInputElement && el.value.trim() !== "";
  });
}

/**
 * Vacía los campos del formulario.
 * No usa form.reset() (restauraría defaultValue de la URL y provoca un flash).
 * Solo navega a /search limpia si la URL aún lleva criterios.
 */
export function ClearSearchFieldsButton() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clearFeedback } = useSearchFeedback();

  function onClear() {
    clearFeedback();
    const form = document.getElementById(SEARCH_FORM_ID) as HTMLFormElement | null;

    if (urlHasSearchParams(searchParams)) {
      // Quitar resultados vía URL; el remount deja el form vacío.
      router.push("/search");
      return;
    }

    if (form && formHasValues(form)) {
      blankFormFields(form);
    }
    // Ya vacío y sin params → no hacer nada.
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
