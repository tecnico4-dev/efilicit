"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { formatCpvSelection, resolveCpvFromInput } from "@/lib/cpv";
import {
  CLEAR_SEARCH_EVENT,
  useSearchFeedback,
} from "./search-feedback";

type CpvMatchMode = "any" | "all";

type CpvPickerProps = {
  /** Códigos CPV de 8 dígitos ya seleccionados (desde la URL). */
  initialCodes?: string[];
  /** `any` (default) | `all` — ADR 019. */
  initialMatch?: CpvMatchMode;
};

/**
 * Código CPV (prefijo) + Añadir → lista «CPV seleccionados» (`code-descripción`).
 * Los hidden `name=cpv` / radio `cpv_match` viajan en el GET / criteria.
 */
export function CpvPicker({
  initialCodes = [],
  initialMatch = "any",
}: CpvPickerProps) {
  const draftId = useId();
  const selectedId = useId();
  const { clearFeedback } = useSearchFeedback();
  const [draft, setDraft] = useState("");
  const [fieldMessage, setFieldMessage] = useState<{
    text: string;
    tone: "error" | "info";
  } | null>(null);
  const [codes, setCodes] = useState<string[]>(() =>
    uniqueNormalized(initialCodes),
  );
  const [matchMode, setMatchMode] = useState<CpvMatchMode>(
    initialMatch === "all" ? "all" : "any",
  );

  const reset = useCallback(() => {
    setDraft("");
    setFieldMessage(null);
    setCodes([]);
    setMatchMode("any");
  }, []);

  useEffect(() => {
    const onClear = () => reset();
    window.addEventListener(CLEAR_SEARCH_EVENT, onClear);
    return () => window.removeEventListener(CLEAR_SEARCH_EVENT, onClear);
  }, [reset]);

  function addFromDraft() {
    const resolved = resolveCpvFromInput(draft);
    if (!resolved) {
      setFieldMessage({
        text: "Indica un código o prefijo CPV numérico.",
        tone: "error",
      });
      return;
    }
    if (!resolved.known) {
      setFieldMessage({
        text: `CPV ${resolved.code} no está en el diccionario.`,
        tone: "error",
      });
      return;
    }
    if (codes.includes(resolved.code)) {
      setFieldMessage({
        text: `El CPV ${resolved.code} ya está seleccionado.`,
        tone: "error",
      });
      setDraft("");
      return;
    }
    clearFeedback();
    setCodes((prev) => [...prev, resolved.code]);
    setDraft("");
    setFieldMessage(
      resolved.omittedNonDigits
        ? {
            text: "CPV añadido omitiendo caracteres no numéricos.",
            tone: "info",
          }
        : null,
    );
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
            onChange={(e) => {
              setDraft(e.target.value);
              if (fieldMessage) setFieldMessage(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addFromDraft();
              }
            }}
            aria-invalid={fieldMessage?.tone === "error"}
            aria-describedby={
              fieldMessage ? `${draftId}-message` : undefined
            }
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
        {fieldMessage ? (
          <p
            id={`${draftId}-message`}
            className={
              fieldMessage.tone === "error"
                ? "mt-1 text-xs text-destructive"
                : "mt-1 text-xs text-muted-foreground"
            }
            role={fieldMessage.tone === "error" ? "alert" : "status"}
          >
            {fieldMessage.text}
          </p>
        ) : null}
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <label
            htmlFor={selectedId}
            className="text-sm font-medium text-foreground"
          >
            CPV seleccionados
          </label>
          {codes.length >= 2 ? (
            <div
              role="radiogroup"
              aria-label="Coincidencia CPV"
              className="flex shrink-0 gap-3 text-xs text-muted-foreground"
            >
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  name="cpv_match"
                  value="any"
                  checked={matchMode === "any"}
                  onChange={() => setMatchMode("any")}
                />
                Cualquiera
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  name="cpv_match"
                  value="all"
                  checked={matchMode === "all"}
                  onChange={() => setMatchMode("all")}
                />
                Todos
              </label>
            </div>
          ) : (
            <input type="hidden" name="cpv_match" value="any" />
          )}
        </div>
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
    if (resolved?.known && !out.includes(resolved.code)) {
      out.push(resolved.code);
    }
  }
  return out;
}
