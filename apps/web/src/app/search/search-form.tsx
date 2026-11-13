"use client";

import type { ReactNode } from "react";
import { PAGE_TITLE_RULE } from "@/components/shell/page-width";
import {
  ensureEnPlazoParam,
  hasAnyCriterion,
  hasInvalidAmountRange,
  hasInvalidPublicationRange,
} from "@/lib/build-criteria-from-form";
import { ClearSearchFieldsButton } from "./clear-search-fields";
import {
  SearchFeedbackProvider,
  useSearchFeedback,
} from "./search-feedback";
import {
  SearchFormPreviewProvider,
  useSimpleFieldsPreview,
} from "./search-form-preview";
import { SEARCH_FORM_ID } from "./save-search-button";

function SearchFormInner({ children }: { children: ReactNode }) {
  const { feedback, setFeedback, clearFeedback } = useSearchFeedback();
  useSimpleFieldsPreview();

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
        ensureEnPlazoParam(e.currentTarget);
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
      <SearchFormPreviewProvider>
        <SearchFormInner>{children}</SearchFormInner>
      </SearchFormPreviewProvider>
    </SearchFeedbackProvider>
  );
}
