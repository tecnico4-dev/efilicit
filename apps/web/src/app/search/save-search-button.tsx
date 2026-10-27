"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { criteriaEqual, parseCriteria } from "@/lib/criteria-display";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  createOwnSavedSearch,
  listOwnSavedSearches,
} from "@/lib/queries";
import type { SearchCriteria } from "@efilicit/types";
import { tokenizeKeywords } from "@/lib/keywords";
import { useSearchFeedback } from "./search-feedback";

const FORM_ID = "search-form";

function readField(form: HTMLFormElement, name: string): string {
  const el = form.elements.namedItem(name);
  if (el instanceof RadioNodeList) {
    return String(el.value ?? "").trim();
  }
  if (el instanceof HTMLInputElement) {
    if (el.type === "checkbox") return el.checked ? el.value.trim() || "1" : "";
    return el.value.trim();
  }
  if (el instanceof HTMLSelectElement) {
    return el.value.trim();
  }
  return "";
}

function readAllFields(form: HTMLFormElement, name: string): string[] {
  const el = form.elements.namedItem(name);
  if (el instanceof RadioNodeList) {
    return [...el]
      .filter((node): node is HTMLInputElement => node instanceof HTMLInputElement)
      .map((node) => node.value.trim())
      .filter(Boolean);
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
    const v = el.value.trim();
    return v ? [v] : [];
  }
  return [];
}

function buildCriteria(form: HTMLFormElement): SearchCriteria | null {
  const q = readField(form, "q");
  const cpvCodes = readAllFields(form, "cpv");
  const cpvMatchRaw = readField(form, "cpv_match").toLowerCase();
  const cpvMatch =
    cpvCodes.length >= 2 && cpvMatchRaw === "all" ? ("all" as const) : undefined;
  const minRaw = readField(form, "min");
  const maxRaw = readField(form, "max");
  const ccaa = readField(form, "ccaa");
  const municipality = readField(form, "municipality");
  const status = readField(form, "status");
  const procedure = readField(form, "procedure");
  const contractType = readField(form, "contract_type");
  const pubFrom = readField(form, "pub_from");
  const pubTo = readField(form, "pub_to");
  const openForSubmission = readField(form, "en_plazo") === "1";
  const min = minRaw === "" ? undefined : Number(minRaw);
  const max = maxRaw === "" ? undefined : Number(maxRaw);

  const keywords = q ? tokenizeKeywords(q) : undefined;

  const hasSomething =
    (keywords && keywords.length > 0) ||
    cpvCodes.length > 0 ||
    (min != null && !Number.isNaN(min)) ||
    (max != null && !Number.isNaN(max)) ||
    ccaa !== "" ||
    municipality !== "" ||
    status !== "" ||
    procedure !== "" ||
    contractType !== "" ||
    pubFrom !== "" ||
    pubTo !== "" ||
    openForSubmission;

  if (!hasSomething) return null;

  return {
    version: 1,
    keywords: keywords?.length ? keywords : undefined,
    cpv_codes: cpvCodes.length ? cpvCodes : undefined,
    cpv_match: cpvMatch,
    estimated_value_min: min != null && !Number.isNaN(min) ? min : undefined,
    estimated_value_max: max != null && !Number.isNaN(max) ? max : undefined,
    statuses: status ? [status] : undefined,
    procedure_types: procedure ? [procedure] : undefined,
    contract_types: contractType ? [contractType] : undefined,
    publication_date_from: pubFrom || undefined,
    publication_date_to: pubTo || undefined,
    open_for_submission: openForSubmission || undefined,
    geography:
      ccaa || municipality
        ? {
            ccaa_codes: ccaa ? [ccaa] : undefined,
            municipality_codes: municipality ? [municipality] : undefined,
          }
        : undefined,
  };
}

/**
 * Guarda los criterios del formulario: pide nombre en modal.
 */
export function SaveSearchButton({ userId }: { userId: string }) {
  const router = useRouter();
  const { setFeedback } = useSearchFeedback();
  const titleId = useId();
  const [pending, setPending] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [criteria, setCriteria] = useState<SearchCriteria | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!dialogOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [dialogOpen]);

  function openDialog() {
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

    const minVal = built.estimated_value_min;
    const maxVal = built.estimated_value_max;
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

    const pubFrom = built.publication_date_from;
    const pubTo = built.publication_date_to;
    if (pubFrom && pubTo && pubFrom > pubTo) {
      setFeedback({
        text: "Rango de fechas de publicación inválido.",
        isError: true,
      });
      return;
    }

    setCriteria(built);
    setName("");
    setDialogError(null);
    setDialogOpen(true);
  }

  async function onConfirmSave() {
    if (!criteria) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setDialogError("Indica un nombre para la búsqueda.");
      return;
    }

    setPending(true);
    setDialogError(null);
    const client = createSupabaseBrowserClient();

    const existing = await listOwnSavedSearches(client);
    if (existing.error) {
      setPending(false);
      setDialogError(existing.error.message);
      return;
    }
    const nameTaken = existing.data.some(
      (s) => s.name.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (nameTaken) {
      setPending(false);
      setDialogError("Ya existe una búsqueda guardada con este nombre.");
      return;
    }
    const duplicate = existing.data.some((s) =>
      criteriaEqual(criteria, parseCriteria(s.criteria)),
    );
    if (duplicate) {
      setPending(false);
      setDialogError(
        "Ya tienes una búsqueda guardada con esos mismos parámetros.",
      );
      return;
    }

    const { error } = await createOwnSavedSearch(client, {
      userId,
      name: trimmed,
      criteria,
    });
    setPending(false);

    if (error) {
      setDialogError(error.message);
      return;
    }

    setDialogOpen(false);
    setFeedback({
      text: "Búsqueda guardada. Puedes verla en Favoritos.",
      isError: false,
      linkHref: "/favorites",
      linkLabel: "Ir a Favoritos",
    });
    router.refresh();
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={openDialog}>
        Guardar búsqueda
      </Button>
      {dialogOpen && mounted
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
              role="presentation"
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-xl"
              >
                <h2
                  id={titleId}
                  className="text-lg font-semibold tracking-tight text-foreground"
                >
                  Guardar búsqueda
                </h2>
                <label className="mt-4 block text-sm font-medium text-foreground">
                  Nombre
                  <Input
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (dialogError) setDialogError(null);
                    }}
                    className="mt-1"
                    autoFocus
                    maxLength={120}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void onConfirmSave();
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setDialogOpen(false);
                      }
                    }}
                  />
                </label>
                {dialogError ? (
                  <p className="mt-2 text-xs text-destructive" role="alert">
                    {dialogError}
                  </p>
                ) : null}
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    disabled={pending}
                    onClick={() => void onConfirmSave()}
                  >
                    {pending ? "Guardando…" : "Aceptar"}
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export { FORM_ID as SEARCH_FORM_ID };
