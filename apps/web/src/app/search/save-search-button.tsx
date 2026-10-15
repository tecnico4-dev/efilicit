"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { criteriaEqual, parseCriteria } from "@/lib/criteria-display";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createOwnSavedSearch, listOwnSavedSearches } from "@/lib/queries";
import type { SearchCriteria } from "@efilicit/types";
import { useSearchFeedback } from "./search-feedback";

const FORM_ID = "search-form";

function readField(form: HTMLFormElement, name: string): string {
  const el = form.elements.namedItem(name);
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
    return el.value.trim();
  }
  return "";
}

function buildCriteria(form: HTMLFormElement): {
  criteria: SearchCriteria;
  name: string;
} | null {
  const q = readField(form, "q");
  const cpv = readField(form, "cpv");
  const minRaw = readField(form, "min");
  const maxRaw = readField(form, "max");
  const ccaa = readField(form, "ccaa");
  const min = minRaw === "" ? undefined : Number(minRaw);
  const max = maxRaw === "" ? undefined : Number(maxRaw);

  const keywords = q
    ? q
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  const hasSomething =
    (keywords && keywords.length > 0) ||
    cpv !== "" ||
    (min != null && !Number.isNaN(min)) ||
    (max != null && !Number.isNaN(max)) ||
    ccaa !== "";

  if (!hasSomething) return null;

  const criteria: SearchCriteria = {
    version: 1,
    keywords: keywords?.length ? keywords : undefined,
    cpv_codes: cpv ? [cpv] : undefined,
    estimated_value_min: min != null && !Number.isNaN(min) ? min : undefined,
    estimated_value_max: max != null && !Number.isNaN(max) ? max : undefined,
    geography: ccaa ? { ccaa_codes: [ccaa] } : undefined,
  };

  const name =
    q ||
    (ccaa ? `CCAA ${ccaa}` : null) ||
    (cpv ? `CPV ${cpv}` : null) ||
    "Búsqueda guardada";

  return { criteria, name };
}

/**
 * Guarda los criterios del formulario de búsqueda.
 * El mensaje usa el feedback compartido del SearchForm (sustituye al de Buscar).
 */
export function SaveSearchButton({ userId }: { userId: string }) {
  const router = useRouter();
  const { setFeedback } = useSearchFeedback();
  const [pending, setPending] = useState(false);

  async function onSave() {
    const form = document.getElementById(FORM_ID) as HTMLFormElement | null;
    if (!form) {
      setFeedback({
        text: "No se encontró el formulario de búsqueda.",
        isError: true,
      });
      return;
    }

    const built = buildCriteria(form);
    if (!built) {
      setFeedback({
        text: "Indica al menos un criterio antes de guardar.",
        isError: true,
      });
      return;
    }

    const minVal = built.criteria.estimated_value_min;
    const maxVal = built.criteria.estimated_value_max;
    if (
      minVal != null &&
      maxVal != null &&
      !Number.isNaN(minVal) &&
      !Number.isNaN(maxVal) &&
      minVal > maxVal
    ) {
      setFeedback({
        text: "Importe solicitado inválido.",
        isError: true,
      });
      return;
    }

    setPending(true);
    const client = createSupabaseBrowserClient();
    const existing = await listOwnSavedSearches(client);
    if (existing.error) {
      setPending(false);
      setFeedback({ text: existing.error.message, isError: true });
      return;
    }
    const duplicate = existing.data.some((s) =>
      criteriaEqual(built.criteria, parseCriteria(s.criteria)),
    );
    if (duplicate) {
      setPending(false);
      setFeedback({
        text: "Ya tienes una búsqueda guardada con esos mismos parámetros.",
        isError: true,
      });
      return;
    }

    const { error } = await createOwnSavedSearch(client, {
      userId,
      name: built.name,
      criteria: built.criteria,
    });
    setPending(false);

    if (error) {
      setFeedback({ text: error.message, isError: true });
      return;
    }

    setFeedback({
      text: "Búsqueda guardada. Puedes verla en Favoritos.",
      isError: false,
      linkHref: "/favorites",
      linkLabel: "Ir a Favoritos",
    });
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={onSave}
    >
      {pending ? "Guardando…" : "Guardar búsqueda"}
    </Button>
  );
}

export { FORM_ID as SEARCH_FORM_ID };
