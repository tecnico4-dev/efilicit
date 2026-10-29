"use client";

import type { ReactNode } from "react";
import { PAGE_TITLE_RULE } from "@/components/shell/page-width";
import { ClearSearchFieldsButton } from "./clear-search-fields";
import {
  SearchFeedbackProvider,
  useSearchFeedback,
} from "./search-feedback";
import { SEARCH_FORM_ID } from "./save-search-button";

function readField(form: HTMLFormElement, name: string): string {
  const el = form.elements.namedItem(name);
  if (el instanceof RadioNodeList) {
    for (const node of el) {
      if (node instanceof HTMLInputElement && node.value.trim() !== "") {
        return node.value.trim();
      }
    }
    return "";
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
    return el.value.trim();
  }
  return "";
}

function hasAnyCriterion(form: HTMLFormElement): boolean {
  const names = [
    "q",
    "cpv",
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
  return names.some((name) => {
    if (name === "en_plazo") {
      const el = form.elements.namedItem(name);
      return el instanceof HTMLInputElement && el.checked;
    }
    return readField(form, name) !== "";
  });
}

/** Fechas de publicación: ambas rellenadas y desde > hasta. */
function hasInvalidPublicationRange(form: HTMLFormElement): boolean {
  const from = readField(form, "pub_from");
  const to = readField(form, "pub_to");
  if (from === "" || to === "") return false;
  return from > to;
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

function SearchFormInner({ children }: { children: ReactNode }) {
  const { feedback, setFeedback, clearFeedback } = useSearchFeedback();

  return (
    <form
      id={SEARCH_FORM_ID}
      method="get"
      className={`space-y-4 ${PAGE_TITLE_RULE}`}
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
        if (hasInvalidPublicationRange(e.currentTarget)) {
          e.preventDefault();
          setFeedback({
            text: "Rango de fechas de publicación inválido.",
            isError: true,
          });
          return;
        }
        clearFeedback();
      }}
    >
      {children}
      <div className="space-y-2">
        <ClearSearchFieldsButton />
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark"
          >
            Buscar
          </button>
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
 * Formulario GET de búsqueda; un solo hueco de feedback compartido.
 */
export function SearchForm({
  children,
  formKey,
}: {
  children: ReactNode;
  /** Remonta el form al cambiar la URL (p. ej. nav Búsqueda limpia). */
  formKey?: string;
}) {
  return (
    <SearchFeedbackProvider key={formKey}>
      <SearchFormInner>{children}</SearchFormInner>
    </SearchFeedbackProvider>
  );
}
