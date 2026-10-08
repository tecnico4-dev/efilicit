"use client";

import { useState, type ReactNode } from "react";
import { SEARCH_FORM_ID } from "./save-search-button";

function hasAnyCriterion(form: HTMLFormElement): boolean {
  const read = (name: string) => {
    const el = form.elements.namedItem(name);
    if (el instanceof HTMLInputElement) return el.value.trim();
    return "";
  };
  const q = read("q");
  const cpv = read("cpv");
  const min = read("min");
  const max = read("max");
  return q !== "" || cpv !== "" || min !== "" || max !== "";
}

/**
 * Formulario GET de búsqueda con validación vacía (mismo tono de error
 * que «Guardar búsqueda»).
 */
export function SearchForm({
  children,
  actions,
}: {
  children: ReactNode;
  actions: ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      id={SEARCH_FORM_ID}
      method="get"
      className="mt-8 space-y-4"
      role="search"
      onSubmit={(e) => {
        if (!hasAnyCriterion(e.currentTarget)) {
          e.preventDefault();
          setError("Indica al menos un criterio antes de buscar.");
          return;
        }
        setError(null);
      }}
    >
      {children}
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
