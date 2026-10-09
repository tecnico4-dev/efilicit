"use client";

import type { ReactNode } from "react";
import {
  SearchFeedbackProvider,
  useSearchFeedback,
} from "./search-feedback";
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

function SearchFormInner({
  children,
  actions,
}: {
  children: ReactNode;
  actions: ReactNode;
}) {
  const { feedback, setFeedback, clearFeedback } = useSearchFeedback();

  return (
    <form
      id={SEARCH_FORM_ID}
      method="get"
      className="mt-8 space-y-4"
      role="search"
      onSubmit={(e) => {
        if (!hasAnyCriterion(e.currentTarget)) {
          e.preventDefault();
          setFeedback({
            text: "Indica al menos un criterio antes de buscar.",
            isError: true,
          });
          return;
        }
        clearFeedback();
      }}
    >
      {children}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {actions}
        {feedback ? (
          <p
            className={`text-xs ${feedback.isError ? "text-destructive" : "text-muted-foreground"}`}
            role={feedback.isError ? "alert" : "status"}
          >
            {feedback.text}
            {feedback.linkHref && feedback.linkLabel ? (
              <>
                {" "}
                <a
                  href={feedback.linkHref}
                  className="font-medium text-link hover:underline"
                >
                  {feedback.linkLabel}
                </a>
              </>
            ) : null}
          </p>
        ) : null}
      </div>
    </form>
  );
}

/**
 * Formulario GET de búsqueda; un solo hueco de feedback compartido
 * (Buscar / Guardar búsqueda se sustituyen entre sí).
 */
export function SearchForm({
  children,
  actions,
}: {
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <SearchFeedbackProvider>
      <SearchFormInner actions={actions}>{children}</SearchFormInner>
    </SearchFeedbackProvider>
  );
}
