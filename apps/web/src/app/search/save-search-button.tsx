"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUndoToast } from "@/components/undo-toast";
import { cn } from "@/lib/cn";
import { criteriaEqual, parseCriteria } from "@/lib/criteria-display";
import { buildCriteriaFromSearchForm } from "@/lib/build-criteria-from-form";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  createOwnSavedSearch,
  deleteOwnSavedSearch,
  listOwnSavedSearches,
} from "@/lib/queries";
import type { SearchCriteria } from "@efilicit/types";
import { useSearchFeedback } from "./search-feedback";
import { isSearchFormPreviewing } from "./search-form-preview";

type MatchedSavedSearch = {
  id: string;
  name: string;
  criteria: SearchCriteria;
};

const FORM_ID = "search-form";

function buildCriteria(form: HTMLFormElement): SearchCriteria | null {
  return buildCriteriaFromSearchForm(form);
}

/**
 * Marcador (bookmark) estilo favoritos: outline gris / relleno azul eficen.
 * Un solo path (sin sombra de fondo).
 */
function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18.5 21.25 12 16.5l-6.5 4.75V5.25A2.25 2.25 0 0 1 7.75 3h8.5a2.25 2.25 0 0 1 2.25 2.25z" />
    </svg>
  );
}

/**
 * Guarda los criterios del formulario: icono tipo favoritos + modal de nombre.
 * Vacío → desactivado; guardada → click elimina (toast + Revertir).
 */
export function SaveSearchButton({ userId }: { userId: string }) {
  const router = useRouter();
  const { setFeedback } = useSearchFeedback();
  const { showUndo, showStatus } = useUndoToast();
  const titleId = useId();
  const [pending, setPending] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hasCriteria, setHasCriteria] = useState(false);
  const [matched, setMatched] = useState<MatchedSavedSearch | null>(null);
  const [name, setName] = useState("");
  const [criteria, setCriteria] = useState<SearchCriteria | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const saved = matched != null;
  const disabled = pending || (!saved && !hasCriteria);

  useEffect(() => {
    setMounted(true);
  }, []);

  /** Criterios del form + match con búsquedas guardadas. */
  async function syncFromForm() {
    const form = document.getElementById(FORM_ID) as HTMLFormElement | null;
    if (!form) {
      setHasCriteria(false);
      setMatched(null);
      return;
    }
    const built = buildCriteria(form);
    setHasCriteria(built != null);
    if (!built) {
      setMatched(null);
      return;
    }
    const client = createSupabaseBrowserClient();
    const existing = await listOwnSavedSearches(client);
    if (existing.error) return;
    const hit = existing.data.find((s) =>
      criteriaEqual(built, parseCriteria(s.criteria)),
    );
    setMatched(
      hit
        ? {
            id: hit.id,
            name: hit.name,
            criteria: parseCriteria(hit.criteria),
          }
        : null,
    );
  }

  useEffect(() => {
    void syncFromForm();
    const form = document.getElementById(FORM_ID) as HTMLFormElement | null;
    if (!form) return;
    const onChange = () => {
      if (isSearchFormPreviewing(form)) return;
      void syncFromForm();
    };
    form.addEventListener("input", onChange);
    form.addEventListener("change", onChange);
    return () => {
      form.removeEventListener("input", onChange);
      form.removeEventListener("change", onChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync once + listeners
  }, [userId]);

  useEffect(() => {
    if (!dialogOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [dialogOpen]);

  async function onUnsave() {
    if (pending || !matched) return;
    setPending(true);
    const snapshot = matched;
    const client = createSupabaseBrowserClient();
    const { error } = await deleteOwnSavedSearch(client, {
      searchId: snapshot.id,
    });
    setPending(false);
    if (error) {
      showStatus(`No se pudo eliminar: ${error.message}`);
      return;
    }
    setMatched(null);
    showUndo("Búsqueda eliminada de favoritos.", async () => {
      const c = createSupabaseBrowserClient();
      await createOwnSavedSearch(c, {
        userId,
        name: snapshot.name,
        criteria: snapshot.criteria,
      });
      await syncFromForm();
      router.refresh();
    });
    router.refresh();
  }

  function openDialog() {
    if (!hasCriteria) return;

    const form = document.getElementById(FORM_ID) as HTMLFormElement | null;
    if (!form) {
      setFeedback({
        text: "No se encontró el formulario de búsqueda.",
        isError: true,
      });
      return;
    }

    const built = buildCriteria(form);
    if (!built) return;

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

  function onBookmarkClick() {
    if (disabled) return;
    if (saved) {
      void onUnsave();
      return;
    }
    openDialog();
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

    const { data: created, error } = await createOwnSavedSearch(client, {
      userId,
      name: trimmed,
      criteria,
    });
    setPending(false);

    if (error || !created) {
      setDialogError(error?.message ?? "No se pudo guardar.");
      return;
    }

    setDialogOpen(false);
    setMatched({
      id: created.id,
      name: created.name,
      criteria: parseCriteria(created.criteria),
    });
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={onBookmarkClick}
        aria-label={saved ? "Quitar búsqueda guardada" : "Guardar búsqueda"}
        title={
          disabled && !saved
            ? "Indica algún criterio para guardar"
            : saved
              ? "Quitar búsqueda guardada"
              : "Guardar búsqueda"
        }
        aria-pressed={saved}
        className={cn(
          "shrink-0 rounded-md p-1.5 transition-colors outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-40 disabled:pointer-events-none",
          saved
            ? "text-primary hover:bg-primary/10"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <BookmarkIcon filled={saved} />
      </button>
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
