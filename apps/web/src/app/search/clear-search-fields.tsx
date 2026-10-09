"use client";

import { useRouter } from "next/navigation";
import { useSearchFeedback } from "./search-feedback";
import { SEARCH_FORM_ID } from "./save-search-button";

/** Texto gris sin borde: vacía el formulario y la URL de búsqueda. */
export function ClearSearchFieldsButton() {
  const router = useRouter();
  const { clearFeedback } = useSearchFeedback();

  function onClear() {
    clearFeedback();
    const form = document.getElementById(SEARCH_FORM_ID) as HTMLFormElement | null;
    if (form) form.reset();
    router.push("/search");
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
