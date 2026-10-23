"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  formatCpvSelection,
  lookupCpvLabel,
  resolveCpvFromInput,
  suggestCpvByPrefix,
} from "@/lib/cpv";
import { CpvDictionaryDialog } from "./cpv-dictionary-dialog";
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

const SUGGEST_LIMIT = 10;

/**
 * Código CPV (prefijo) + Añadir → lista «CPV seleccionados» (`code-descripción`).
 * Typeahead por prefijo numérico (estilo sugerencias). Los hidden `name=cpv` /
 * radio `cpv_match` viajan en el GET / criteria.
 */
export function CpvPicker({
  initialCodes = [],
  initialMatch = "any",
}: CpvPickerProps) {
  const draftId = useId();
  const listId = useId();
  const selectedId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
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
  const [dictOpen, setDictOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const suggestions = useMemo(
    () =>
      suggestCpvByPrefix(draft, {
        limit: SUGGEST_LIMIT,
        exclude: codes,
      }),
    [draft, codes],
  );

  const showSuggestions =
    suggestOpen && draft.replace(/\D/g, "").length > 0 && suggestions.length > 0;

  const reset = useCallback(() => {
    setDraft("");
    setFieldMessage(null);
    setCodes([]);
    setMatchMode("any");
    setDictOpen(false);
    setSuggestOpen(false);
    setActiveIndex(-1);
  }, []);

  useEffect(() => {
    const onClear = () => reset();
    window.addEventListener(CLEAR_SEARCH_EVENT, onClear);
    return () => window.removeEventListener(CLEAR_SEARCH_EVENT, onClear);
  }, [reset]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setSuggestOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  useEffect(() => {
    setActiveIndex(-1);
  }, [draft, codes]);

  function addCode(code: string, omittedNonDigits = false): boolean {
    if (codes.includes(code)) {
      setFieldMessage({
        text: `El CPV ${code} ya está seleccionado.`,
        tone: "error",
      });
      setDraft("");
      setSuggestOpen(false);
      return false;
    }
    if (!lookupCpvLabel(code)) {
      setFieldMessage({
        text: `CPV ${code} no está en el diccionario.`,
        tone: "error",
      });
      return false;
    }
    clearFeedback();
    setCodes((prev) => [...prev, code]);
    setDraft("");
    setSuggestOpen(false);
    setActiveIndex(-1);
    setFieldMessage(
      omittedNonDigits
        ? {
            text: "CPV añadido omitiendo caracteres no numéricos.",
            tone: "info",
          }
        : null,
    );
    return true;
  }

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
    addCode(resolved.code, resolved.omittedNonDigits);
  }

  function pickSuggestion(code: string) {
    addCode(code);
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
          <div ref={wrapRef} className="relative min-w-0 flex-1">
            <input
              id={draftId}
              name="cpv_draft"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              role="combobox"
              aria-expanded={showSuggestions}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                showSuggestions && activeIndex >= 0
                  ? `${listId}-opt-${activeIndex}`
                  : undefined
              }
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setSuggestOpen(true);
                if (fieldMessage) setFieldMessage(null);
              }}
              onFocus={() => setSuggestOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSuggestOpen(false);
                  setActiveIndex(-1);
                  return;
                }
                if (showSuggestions && e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveIndex((i) =>
                    i < suggestions.length - 1 ? i + 1 : 0,
                  );
                  return;
                }
                if (showSuggestions && e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveIndex((i) =>
                    i <= 0 ? suggestions.length - 1 : i - 1,
                  );
                  return;
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (showSuggestions && activeIndex >= 0) {
                    pickSuggestion(suggestions[activeIndex].code);
                    return;
                  }
                  if (showSuggestions && suggestions.length === 1) {
                    pickSuggestion(suggestions[0].code);
                    return;
                  }
                  addFromDraft();
                }
              }}
              aria-invalid={fieldMessage?.tone === "error"}
              aria-describedby={
                fieldMessage ? `${draftId}-message` : undefined
              }
              className="w-full rounded-md border border-border bg-background py-2 pl-3 pr-10 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => setDictOpen(true)}
              className="absolute top-1/2 right-2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-primary/35 bg-primary-light/70 font-serif text-[0.85rem] leading-none text-primary-dark italic hover:border-primary/55 hover:bg-primary-light"
              aria-label="Abrir diccionario CPV"
              title="Diccionario CPV"
            >
              i
            </button>
            {showSuggestions ? (
              <ul
                id={listId}
                role="listbox"
                className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-background py-1 shadow-md"
              >
                {suggestions.map((opt, index) => {
                  const active = index === activeIndex;
                  return (
                    <li
                      key={opt.code}
                      id={`${listId}-opt-${index}`}
                      role="option"
                      aria-selected={active}
                    >
                      <button
                        type="button"
                        className={
                          active
                            ? "w-full bg-muted px-3 py-1.5 text-left text-sm text-foreground"
                            : "w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted"
                        }
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => pickSuggestion(opt.code)}
                      >
                        <span className="font-mono tabular-nums">{opt.code}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground normal-case">
                          {opt.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
          <button
            type="button"
            onClick={addFromDraft}
            className="shrink-0 rounded-md border border-primary/35 bg-primary-light/50 px-3 py-2 text-sm font-medium text-primary-dark hover:border-primary/50 hover:bg-primary-light/80"
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
        <label
          htmlFor={selectedId}
          className="block text-sm font-medium text-foreground"
        >
          CPV seleccionados
        </label>
        <div className="relative mt-1">
          {codes.length >= 2 ? (
            <div
              role="radiogroup"
              aria-label="Coincidencia CPV"
              className="absolute right-0 bottom-full z-10 flex translate-y-px gap-1"
            >
              <label
                className={
                  matchMode === "any"
                    ? "cursor-pointer rounded-t-md border border-border border-b-[color-mix(in_srgb,var(--muted)_30%,transparent)] bg-muted/30 px-2.5 py-1 text-xs font-medium text-primary"
                    : "cursor-pointer rounded-t-md border border-transparent px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }
              >
                <input
                  type="radio"
                  name="cpv_match"
                  value="any"
                  checked={matchMode === "any"}
                  onChange={() => setMatchMode("any")}
                  className="sr-only"
                />
                Cualquiera
              </label>
              <label
                className={
                  matchMode === "all"
                    ? "cursor-pointer rounded-t-md border border-border border-b-[color-mix(in_srgb,var(--muted)_30%,transparent)] bg-muted/30 px-2.5 py-1 text-xs font-medium text-primary"
                    : "cursor-pointer rounded-t-md border border-transparent px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }
              >
                <input
                  type="radio"
                  name="cpv_match"
                  value="all"
                  checked={matchMode === "all"}
                  onChange={() => setMatchMode("all")}
                  className="sr-only"
                />
                Todos
              </label>
            </div>
          ) : (
            <input type="hidden" name="cpv_match" value="any" />
          )}
          <div
            id={selectedId}
            className={
              codes.length >= 2
                ? "min-h-[2.5rem] rounded-md rounded-tr-none border border-border bg-muted/30 px-3 py-2 text-sm"
                : "min-h-[2.5rem] rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
            }
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
        </div>
        {/* Texto oculto solo para accesibilidad / depuración; los hidden son la fuente de verdad del GET */}
        <span className="sr-only">{selectedDisplay}</span>
      </div>
      {codes.map((code) => (
        <input key={code} type="hidden" name="cpv" value={code} />
      ))}
      <CpvDictionaryDialog
        open={dictOpen}
        selectedCodes={codes}
        onCancel={() => setDictOpen(false)}
        onSave={(next) => {
          clearFeedback();
          setCodes(next);
          setFieldMessage(null);
          setDictOpen(false);
        }}
      />
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
