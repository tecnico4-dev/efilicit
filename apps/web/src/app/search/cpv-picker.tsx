"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { formatCpvSelection, resolveCpvFromInput } from "@/lib/cpv";
import {
  CLEAR_SEARCH_EVENT,
  useSearchFeedback,
} from "./search-feedback";

type CpvPickerProps = {
  /** Códigos CPV de 8 dígitos ya seleccionados (desde la URL). */
  initialCodes?: string[];
};

/**
 * Código CPV (prefijo) + Añadir → lista «CPV seleccionados» (`code-descripción`).
 * Los hidden `name=cpv` son los que viajan en el GET / se guardan en criteria.
 */
export function CpvPicker({ initialCodes = [] }: CpvPickerProps) {
  const draftId = useId();
  const selectedId = useId();
  const { setFeedback, clearFeedback } = useSearchFeedback();
  const [draft, setDraft] = useState("");
  const [codes, setCodes] = useState<string[]>(() =>
    uniqueNormalized(initialCodes),
  );

  const reset = useCallback(() => {
    setDraft("");
    setCodes([]);
  }, []);

  useEffect(() => {
    const onClear = () => reset();
    window.addEventListener(CLEAR_SEARCH_EVENT, onClear);
    return () => window.removeEventListener(CLEAR_SEARCH_EVENT, onClear);
  }, [reset]);

  function addFromDraft() {
    const resolved = resolveCpvFromInput(draft);
    if (!resolved) {
      setFeedback({
        text: "Indica un código o prefijo CPV numérico.",
        isError: true,
      });
      return;
    }
    if (codes.includes(resolved.code)) {
      setFeedback({
        text: `El CPV ${resolved.code} ya está seleccionado.`,
        isError: true,
      });
      setDraft("");
      return;
    }
    if (!resolved.known) {
      setFeedback({
        text: `CPV ${resolved.code} no está en el diccionario; se añadirá igual.`,
        isError: false,
      });
    } else {
      clearFeedback();
    }
    setCodes((prev) => [...prev, resolved.code]);
    setDraft("");
  }

  function removeCode(code: string) {
    setCodes((prev) => prev.filter((c) => c !== code));
  }

  const selectedDisplay = codes.map(formatCpvSelection).join("\n");

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label
          htmlFor={draftId}
          className="block text-sm font-medium text-foreground"
        >
          Código CPV (prefijo)
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id={draftId}
            name="cpv_draft"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addFromDraft();
              }
            }}
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={addFromDraft}
            className="shrink-0 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Añadir
          </button>
        </div>
      </div>
      <div>
        <label
          htmlFor={selectedId}
          className="block text-sm font-medium text-foreground"
        >
          CPV seleccionados
        </label>
        <div
          id={selectedId}
          className="mt-1 min-h-[2.5rem] rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
        >
          {codes.length === 0 ? (
            <p className="text-muted-foreground">Ninguno</p>
          ) : (
            <ul className="space-y-1">
              {codes.map((code) => (
                <li
                  key={code}
                  className="flex items-start justify-between gap-2 font-mono text-xs sm:text-sm"
                >
                  <span className="min-w-0 break-words text-foreground">
                    {formatCpvSelection(code)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCode(code)}
                    className="shrink-0 text-muted-foreground hover:text-destructive hover:underline"
                    aria-label={`Quitar CPV ${code}`}
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {/* Texto oculto solo para accesibilidad / depuración; los hidden son la fuente de verdad del GET */}
        <span className="sr-only">{selectedDisplay}</span>
      </div>
      {codes.map((code) => (
        <input key={code} type="hidden" name="cpv" value={code} />
      ))}
    </div>
  );
}

function uniqueNormalized(codes: string[]): string[] {
  const out: string[] = [];
  for (const raw of codes) {
    const resolved = resolveCpvFromInput(raw);
    if (resolved && !out.includes(resolved.code)) out.push(resolved.code);
  }
  return out;
}
