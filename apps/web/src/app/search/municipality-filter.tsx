"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { listPlaceMunicipalities } from "@/lib/queries/list-place-municipalities";
import { SEARCH_FORM_ID } from "./save-search-button";

type Option = { code: string; name: string };

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function startsWithFold(name: string, prefix: string): boolean {
  if (!prefix) return true;
  return fold(name).startsWith(fold(prefix));
}

type Props = {
  /** CCAA inicial (URL). */
  initialCcaa: string;
  /** Código INE de municipio inicial (URL), si es válido para esa CCAA. */
  initialMunicipalityCode: string;
  initialMunicipalityName?: string;
};

/**
 * Typeahead de municipio: deshabilitado sin CCAA; opciones = municipios
 * de esa CCAA con ≥1 tender. Prefijo de texto; blur/submit sin match → cancela.
 */
export function MunicipalityFilter({
  initialCcaa,
  initialMunicipalityCode,
  initialMunicipalityName = "",
}: Props) {
  const listId = useId();
  const [ccaa, setCcaa] = useState(initialCcaa);
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState(initialMunicipalityName);
  const [selectedCode, setSelectedCode] = useState(initialMunicipalityCode);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const enabled = ccaa !== "";
  /** CCAA elegida pero sin municipios con licitaciones → mismo bloqueo que sin CCAA. */
  const noMunicipalities = enabled && !loading && options.length === 0;
  const inputDisabled = !enabled || noMunicipalities;

  useEffect(() => {
    const form = document.getElementById(SEARCH_FORM_ID) as HTMLFormElement | null;
    const select = form?.elements.namedItem("ccaa");
    if (!(select instanceof HTMLSelectElement)) return;

    const onCcaaChange = () => {
      const next = select.value.trim();
      setCcaa(next);
      setText("");
      setSelectedCode("");
      setOpen(false);
    };
    select.addEventListener("change", onCcaaChange);
    return () => select.removeEventListener("change", onCcaaChange);
  }, []);

  useEffect(() => {
    if (!ccaa) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const client = createSupabaseBrowserClient();
    void listPlaceMunicipalities(client, ccaa).then((res) => {
      if (cancelled) return;
      setLoading(false);
      setOptions(res.data);
      if (selectedCode) {
        const still = res.data.find((o) => o.code === selectedCode);
        if (!still) {
          setSelectedCode("");
          setText("");
        } else if (!text) {
          setText(still.name);
        }
      }
    });
    return () => {
      cancelled = true;
    };
    // Solo al cambiar CCAA (no al teclear).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [ccaa]);

  const filtered = useMemo(
    () => options.filter((o) => startsWithFold(o.name, text)),
    [options, text],
  );

  function commitOrCancel() {
    if (!selectedCode) {
      // Texto suelto sin selección válida → cancelar.
      const exact = options.find(
        (o) => fold(o.name) === fold(text) && startsWithFold(o.name, text),
      );
      if (exact && startsWithFold(exact.name, text) && fold(exact.name) === fold(text)) {
        setSelectedCode(exact.code);
        setText(exact.name);
        return;
      }
      setText("");
      setSelectedCode("");
      return;
    }
    const sel = options.find((o) => o.code === selectedCode);
    if (!sel || fold(text) !== fold(sel.name)) {
      setText("");
      setSelectedCode("");
    } else {
      setText(sel.name);
    }
  }

  useEffect(() => {
    const form = document.getElementById(SEARCH_FORM_ID) as HTMLFormElement | null;
    if (!form) return;
    const onSubmit = () => {
      // Antes de enviar: si el texto no corresponde a un código válido, vaciar.
      const codeInput = form.elements.namedItem("municipality");
      if (!(codeInput instanceof HTMLInputElement)) return;
      if (!codeInput.value.trim()) {
        setText("");
        setSelectedCode("");
      }
    };
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, []);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        commitOrCancel();
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  });

  return (
    <div ref={wrapRef} className="relative">
      <label
        htmlFor="municipality-text"
        className="block text-sm font-medium text-foreground"
      >
        Municipio
      </label>
      <input type="hidden" name="municipality" value={selectedCode} />
      <input
        id="municipality-text"
        type="text"
        autoComplete="off"
        disabled={inputDisabled}
        value={inputDisabled ? "" : text}
        placeholder={
          !enabled
            ? "Selecciona antes una CCAA"
            : loading
              ? "Cargando…"
              : options.length === 0
                ? "Sin municipios con licitaciones"
                : "Escribe para filtrar…"
        }
        onFocus={() => {
          if (!inputDisabled) setOpen(true);
        }}
        onChange={(e) => {
          if (inputDisabled) return;
          const next = e.target.value;
          setText(next);
          setOpen(true);
          const match = options.find((o) => fold(o.name) === fold(next));
          setSelectedCode(match ? match.code : "");
        }}
        onKeyDown={(e) => {
          if (inputDisabled) return;
          if (e.key === "Escape") {
            setText("");
            setSelectedCode("");
            setOpen(false);
          }
          if (e.key === "Enter" && open && filtered.length === 1) {
            e.preventDefault();
            setSelectedCode(filtered[0].code);
            setText(filtered[0].name);
            setOpen(false);
          }
        }}
        onBlur={() => {
          // blur puede ir antes del click en opción; delay corto.
          window.setTimeout(() => {
            if (!wrapRef.current?.contains(document.activeElement)) {
              setOpen(false);
              commitOrCancel();
            }
          }, 120);
        }}
        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        aria-controls={listId}
        aria-expanded={open && !inputDisabled}
        aria-autocomplete="list"
        role="combobox"
      />
      {!inputDisabled && open && filtered.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-background py-1 shadow-md"
        >
          {filtered.map((opt) => (
            <li key={opt.code} role="option" aria-selected={opt.code === selectedCode}>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setSelectedCode(opt.code);
                  setText(opt.name);
                  setOpen(false);
                }}
              >
                {opt.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {!inputDisabled && open && !loading && text !== "" && filtered.length === 0 ? (
        <p className="absolute z-20 mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground shadow-md">
          Ningún municipio coincide
        </p>
      ) : null}
    </div>
  );
}
