"use client";

import type { ReactNode } from "react";
import { ClearSearchFieldsButton } from "./clear-search-fields";
import {
  SearchFeedbackProvider,
  useSearchFeedback,
} from "./search-feedback";
import { SEARCH_FORM_ID } from "./save-search-button";

function readField(form: HTMLFormElement, name: string): string {
  const el = form.elements.namedItem(name);
  if (el instanceof HTMLInputElement) return el.value.trim();
  return "";
}

function hasAnyCriterion(form: HTMLFormElement): boolean {
  const q = readField(form, "q");
  const cpv = readField(form, "cpv");
  const min = readField(form, "min");
  const max = readField(form, "max");
  return q !== "" || cpv !== "" || min !== "" || max !== "";
}

/** Mínimo y máximo rellenados, y mínimo > máximo. */
function hasInvalidAmountRange(form: HTMLFormElement): boolean {
  const minRaw = readField(form, "min");
  const maxRaw = readField(form, "max");
  if (minRaw === "" || maxRaw === "") return false;
  const min = Number(minRaw);
  const max = Number(maxRaw);
  if (Number.isNaN(min) || Number.isNaN(max)) return false;
  return min > max;
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
        if (hasInvalidAmountRange(e.currentTarget)) {
          e.preventDefault();
          setFeedback({
            text: "Importe solicitado inválido.",
            isError: true,
          });
          return;
        }
        clearFeedback();
      }}
    >
      {children}
      <div className="space-y-2">
        <div>
          <ClearSearchFieldsButton />
        </div>
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
  formKey,
}: {
  children: ReactNode;
  actions: ReactNode;
  /** Remonta el form al cambiar la URL (p. ej. nav Búsqueda limpia). */
  formKey?: string;
}) {
  return (
    <SearchFeedbackProvider key={formKey}>
      <SearchFormInner actions={actions}>{children}</SearchFormInner>
    </SearchFeedbackProvider>
  );
}
