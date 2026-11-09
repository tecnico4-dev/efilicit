"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CriteriaFilters,
  type CriteriaFilterOptionsProp,
} from "@/components/criteria/criteria-filters";
import {
  criteriaEqual,
  criteriaHasFilters,
  emptyCriteriaFilterInitial,
  parseCriteria,
} from "@/lib/criteria-display";
import {
  buildCriteriaFromSearchForm,
  hasInvalidAmountRange,
  hasInvalidPublicationRange,
} from "@/lib/build-criteria-from-form";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { tokenizeKeywords } from "@/lib/keywords";
import {
  createOwnAlert,
  createOwnSavedSearch,
  listOwnSavedSearches,
  ownAlertNameTaken,
  type DigestFrequency,
} from "@/lib/queries";
import type { SearchCriteria } from "@efilicit/types";

export const ALERT_CREATE_FORM_ID = "alert-create-form";

type BuiltAlert = { name: string; criteria: SearchCriteria };

/**
 * Botón «Crear alerta» + modal con criterios, Crear / Guardar como búsqueda /
 * Cancelar y × (igual que Cancelar).
 */
export function AlertsPanel({
  userId,
  digestFrequency,
  filterOptions,
}: {
  userId: string;
  digestFrequency: DigestFrequency;
  filterOptions: CriteriaFilterOptionsProp;
}) {
  const router = useRouter();
  const titleId = useId();
  const confirmTitleId = useId();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [formKey, setFormKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  /** Confirmación si el nombre solo tiene stopwords / tokens < 2. */
  const [confirmEmptyName, setConfirmEmptyName] = useState(false);
  const [pendingBuilt, setPendingBuilt] = useState<BuiltAlert | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (confirmEmptyName) {
        dismissConfirmEmptyName();
        return;
      }
      closeModal();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, confirmEmptyName]);

  function resetForm() {
    setName("");
    setFormKey((k) => k + 1);
    setError(null);
    setConfirmEmptyName(false);
    setPendingBuilt(null);
  }

  function closeModal() {
    setOpen(false);
    resetForm();
    setPending(false);
  }

  function dismissConfirmEmptyName() {
    setConfirmEmptyName(false);
    setPendingBuilt(null);
  }

  function buildOrFail() {
    const form = document.getElementById(
      ALERT_CREATE_FORM_ID,
    ) as HTMLFormElement | null;
    if (!form) {
      setError("No se encontró el formulario.");
      return null;
    }
    if (!name.trim()) {
      setError("Indica un nombre.");
      return null;
    }
    if (hasInvalidAmountRange(form)) {
      setError("Importe solicitado inválido.");
      return null;
    }
    if (hasInvalidPublicationRange(form)) {
      setError("Rango de fechas de publicación inválido.");
      return null;
    }
    const criteria = buildCriteriaFromSearchForm(form);
    if (!criteria || !criteriaHasFilters(criteria)) {
      setError("Indica al menos un criterio de búsqueda.");
      return null;
    }
    return { name: name.trim(), criteria };
  }

  async function persistAlert(built: BuiltAlert) {
    setPending(true);
    const client = createSupabaseBrowserClient();
    const nameCheck = await ownAlertNameTaken(client, { name: built.name });
    if (nameCheck.error) {
      setPending(false);
      setConfirmEmptyName(false);
      setPendingBuilt(null);
      setError(nameCheck.error.message);
      return;
    }
    if (nameCheck.taken) {
      setPending(false);
      setConfirmEmptyName(false);
      setPendingBuilt(null);
      setError("Ya existe una alerta con este nombre.");
      return;
    }

    const { error: createError } = await createOwnAlert(client, {
      userId,
      name: built.name,
      criteria: built.criteria,
      frequency: digestFrequency,
    });
    setPending(false);
    if (createError) {
      setConfirmEmptyName(false);
      setPendingBuilt(null);
      setError(createError.message);
      return;
    }
    closeModal();
    router.refresh();
  }

  async function onCreateAlert() {
    setError(null);
    const built = buildOrFail();
    if (!built) return;

    if (tokenizeKeywords(built.name).length === 0) {
      setPendingBuilt(built);
      setConfirmEmptyName(true);
      return;
    }

    await persistAlert(built);
  }

  async function onConfirmCreateWithoutText() {
    if (!pendingBuilt) return;
    await persistAlert(pendingBuilt);
  }

  async function onCreateSavedSearch() {
    setError(null);
    const built = buildOrFail();
    if (!built) return;

    setPending(true);
    const client = createSupabaseBrowserClient();
    const existing = await listOwnSavedSearches(client);
    if (existing.error) {
      setPending(false);
      setError(existing.error.message);
      return;
    }
    if (
      existing.data.some((s) =>
        criteriaEqual(built.criteria, parseCriteria(s.criteria)),
      )
    ) {
      setPending(false);
      setError("Ya tienes una búsqueda guardada con esos mismos parámetros.");
      return;
    }

    const { error: createError } = await createOwnSavedSearch(client, {
      userId,
      name: built.name,
      criteria: built.criteria,
    });
    setPending(false);
    if (createError) {
      setError(createError.message);
      return;
    }
    closeModal();
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        size="lg"
        className="shrink-0 px-5 text-base"
        onClick={() => {
          resetForm();
          setOpen(true);
        }}
      >
        Crear alerta
      </Button>

      {open && mounted
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-3 sm:p-6"
              role="presentation"
              onClick={closeModal}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="flex max-h-[min(92vh,48rem)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
                  <h2
                    id={titleId}
                    className="text-lg font-semibold leading-none tracking-tight text-foreground"
                  >
                    Crear alerta
                  </h2>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-destructive bg-surface text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Cerrar"
                  >
                    <span aria-hidden className="text-xl leading-none">
                      ×
                    </span>
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                  <form
                    id={ALERT_CREATE_FORM_ID}
                    className="space-y-4"
                    onSubmit={(e) => e.preventDefault()}
                  >
                    <div>
                      <label
                        htmlFor="item_name"
                        className="block text-sm font-medium text-primary"
                      >
                        Nombre de la alerta
                      </label>
                      <Input
                        id="item_name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="mt-1 border-primary/25 bg-primary-light/45"
                        autoFocus
                      />
                    </div>
                    <CriteriaFilters
                      key={formKey}
                      initial={emptyCriteriaFilterInitial()}
                      filterOptions={filterOptions}
                      formId={ALERT_CREATE_FORM_ID}
                      idPrefix="alert-create-"
                    />
                    {error ? (
                      <p className="text-sm text-destructive" role="alert">
                        {error}
                      </p>
                    ) : null}
                  </form>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">
                  <Button
                    type="button"
                    disabled={pending}
                    onClick={onCreateAlert}
                  >
                    Crear
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={onCreateSavedSearch}
                  >
                    Guardar como búsqueda
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={closeModal}
                    className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {open && mounted && confirmEmptyName
        ? createPortal(
            <div
              className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-3 sm:p-6"
              role="presentation"
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={confirmTitleId}
                className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2
                    id={confirmTitleId}
                    className="text-base font-semibold text-foreground"
                  >
                    ¿Seguro que quieres guardar una alerta sin texto?
                  </h2>
                  <button
                    type="button"
                    onClick={dismissConfirmEmptyName}
                    disabled={pending}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-destructive bg-surface text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-60"
                    aria-label="Cerrar"
                  >
                    <span aria-hidden className="text-xl leading-none">
                      ×
                    </span>
                  </button>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  El nombre no tiene términos significativos (solo partículas
                  como «de», «la» o «a»).
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    disabled={pending}
                    onClick={onConfirmCreateWithoutText}
                  >
                    Sí
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={dismissConfirmEmptyName}
                  >
                    No
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={dismissConfirmEmptyName}
                    className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    Cancelar
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
