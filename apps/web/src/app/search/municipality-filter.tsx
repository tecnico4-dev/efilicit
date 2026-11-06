"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { listPlaceMunicipalitiesForCcaas } from "@/lib/queries/list-place-municipalities";
import { criteriaToFilterInitial } from "@/lib/criteria-display";
import { ccaaShortLabel } from "@/lib/geo-ccaa";
import { cn } from "@/lib/cn";
import { SEARCH_FORM_ID } from "./save-search-button";
import {
  SEARCH_APPLY_CRITERIA_EVENT,
  SEARCH_CCAA_SELECTION_EVENT,
  SEARCH_PREVIEW_GHOST_CLASS,
  useOptionalSearchFormPreview,
  type SearchCcaaSelectionDetail,
} from "./search-form-preview";
import { AnchoredPortal } from "@/components/ui/anchored-portal";
import type { SearchCriteria } from "@efilicit/types";

type Option = { code: string; name: string; ccaaCode: string };

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
  /** CCAA iniciales (URL / criteria). */
  initialCcaaCodes: string[];
  /** Código INE de municipio inicial, si es válido para alguna CCAA. */
  initialMunicipalityCode: string;
  initialMunicipalityName?: string;
  formId?: string;
};

/**
 * Typeahead de municipio: deshabilitado sin CCAA; opciones = municipios
 * de todas las CCAA marcadas con ≥1 tender.
 */
export function MunicipalityFilter({
  initialCcaaCodes,
  initialMunicipalityCode,
  initialMunicipalityName = "",
  formId = SEARCH_FORM_ID,
}: Props) {
  const listId = useId();
  const formPreview = useOptionalSearchFormPreview();
  const previewInitial = formPreview?.preview
    ? criteriaToFilterInitial(formPreview.preview)
    : null;
  const isPreviewing = previewInitial != null;
  const previewCcaaCodes = previewInitial?.ccaaCodes ?? [];
  const previewCode = previewInitial?.municipalityCode ?? "";

  const [ccaaCodes, setCcaaCodes] = useState<string[]>(initialCcaaCodes);
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState(initialMunicipalityName);
  const [selectedCode, setSelectedCode] = useState(initialMunicipalityCode);
  const [open, setOpen] = useState(false);
  const [previewName, setPreviewName] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const enabled = ccaaCodes.length > 0;
  const showCcaaHint = ccaaCodes.length >= 2;
  const noMunicipalities = enabled && !loading && options.length === 0;
  const inputDisabled = !enabled || noMunicipalities;
  const interactionLocked = inputDisabled || isPreviewing;

  useEffect(() => {
    function onCcaaSelection(e: Event) {
      const detail = (e as CustomEvent<SearchCcaaSelectionDetail>).detail;
      const next = detail?.codes ?? [];
      setCcaaCodes(next);
      setOpen(false);
    }
    window.addEventListener(SEARCH_CCAA_SELECTION_EVENT, onCcaaSelection);
    return () =>
      window.removeEventListener(SEARCH_CCAA_SELECTION_EVENT, onCcaaSelection);
  }, []);

  useEffect(() => {
    if (ccaaCodes.length === 0) {
      setOptions([]);
      setSelectedCode("");
      setText("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    const client = createSupabaseBrowserClient();
    void listPlaceMunicipalitiesForCcaas(client, ccaaCodes).then((res) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar CCAA
  }, [ccaaCodes.join("\u0001")]);

  useEffect(() => {
    if (!isPreviewing) {
      setPreviewName("");
      setPreviewLoading(false);
      return;
    }
    setOpen(false);
    if (previewCcaaCodes.length === 0 || !previewCode) {
      setPreviewName("");
      setPreviewLoading(false);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    const client = createSupabaseBrowserClient();
    void listPlaceMunicipalitiesForCcaas(client, previewCcaaCodes).then(
      (res) => {
        if (cancelled) return;
        setPreviewLoading(false);
        const hit = res.data.find((o) => o.code === previewCode);
        setPreviewName(hit?.name ?? previewCode);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [isPreviewing, previewCcaaCodes.join("\u0001"), previewCode]);

  useEffect(() => {
    function onApply(e: Event) {
      const criteria = (e as CustomEvent<SearchCriteria>).detail;
      if (!criteria) return;
      const initial = criteriaToFilterInitial(criteria);
      setOpen(false);
      setCcaaCodes(initial.ccaaCodes);
      setSelectedCode(initial.municipalityCode);
      if (!initial.municipalityCode) {
        setText("");
        return;
      }
      if (initial.municipalityName) {
        setText(initial.municipalityName);
        return;
      }
      setText("");
    }
    window.addEventListener(SEARCH_APPLY_CRITERIA_EVENT, onApply);
    return () => window.removeEventListener(SEARCH_APPLY_CRITERIA_EVENT, onApply);
  }, []);

  useEffect(() => {
    if (isPreviewing || !selectedCode || text) return;
    const hit = options.find((o) => o.code === selectedCode);
    if (hit) setText(hit.name);
  }, [isPreviewing, selectedCode, text, options]);

  function commitOrCancel() {
    if (!selectedCode) {
      const exact = options.find(
        (o) => fold(o.name) === fold(text) && startsWithFold(o.name, text),
      );
      if (
        exact &&
        startsWithFold(exact.name, text) &&
        fold(exact.name) === fold(text)
      ) {
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
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const onSubmit = () => {
      const codeInput = form.elements.namedItem("municipality");
      if (!(codeInput instanceof HTMLInputElement)) return;
      if (!codeInput.value.trim()) {
        setText("");
        setSelectedCode("");
      }
    };
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, [formId]);

  useEffect(() => {
    if (isPreviewing) return;
    const form = document.getElementById(formId) as HTMLFormElement | null;
    const codeInput = form?.elements.namedItem("municipality");
    if (!(codeInput instanceof HTMLInputElement)) return;
    codeInput.dispatchEvent(new Event("input", { bubbles: true }));
    codeInput.dispatchEvent(new Event("change", { bubbles: true }));
  }, [selectedCode, formId, isPreviewing]);

  const filtered = useMemo(
    () => options.filter((o) => startsWithFold(o.name, text)),
    [options, text],
  );

  const previewDisplayText = previewCcaaCodes.length === 0
    ? ""
    : !previewCode
      ? ""
      : previewLoading
        ? ""
        : previewName;

  const needCcaaHint = "Selecciona antes una o más CCAA";
  const previewPlaceholder =
    previewCcaaCodes.length === 0
      ? needCcaaHint
      : previewLoading
        ? "Cargando…"
        : "Escribe para filtrar…";

  const committedValue = inputDisabled ? "" : text;
  const displayValue = isPreviewing ? previewDisplayText : committedValue;
  const displayPlaceholder = isPreviewing
    ? previewPlaceholder
    : !enabled
      ? needCcaaHint
      : loading
        ? "Cargando…"
        : options.length === 0
          ? "Sin municipios con licitaciones"
          : "Escribe para filtrar…";

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
        ref={inputRef}
        id="municipality-text"
        type="text"
        autoComplete="off"
        disabled={!isPreviewing && inputDisabled}
        readOnly={isPreviewing}
        value={displayValue}
        placeholder={displayPlaceholder}
        onFocus={() => {
          if (interactionLocked) return;
          setOpen(true);
        }}
        onChange={(e) => {
          if (interactionLocked) return;
          const next = e.target.value;
          setText(next);
          setOpen(true);
          const match = options.find((o) => fold(o.name) === fold(next));
          setSelectedCode(match ? match.code : "");
        }}
        onKeyDown={(e) => {
          if (interactionLocked) return;
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
          window.setTimeout(() => {
            const ae = document.activeElement;
            if (
              wrapRef.current?.contains(ae) ||
              ae?.closest?.("[data-anchored-portal]")
            ) {
              return;
            }
            setOpen(false);
            commitOrCancel();
          }, 120);
        }}
        className={cn(
          "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
          isPreviewing && SEARCH_PREVIEW_GHOST_CLASS,
        )}
        aria-controls={listId}
        aria-expanded={open && !interactionLocked}
        aria-autocomplete="list"
        role="combobox"
      />
      <AnchoredPortal
        open={!interactionLocked && open && filtered.length > 0}
        anchorRef={inputRef}
        onDismiss={() => {
          setOpen(false);
          commitOrCancel();
        }}
        className="bg-background py-1"
        maxHeight={224}
      >
        <ul id={listId} role="listbox">
          {filtered.map((opt) => (
            <li
              key={opt.code}
              role="option"
              aria-selected={opt.code === selectedCode}
            >
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setSelectedCode(opt.code);
                  setText(opt.name);
                  setOpen(false);
                }}
              >
                <span className="min-w-0 flex-1 truncate">{opt.name}</span>
                {showCcaaHint ? (
                  <span className="shrink-0 text-xs text-muted-foreground/70">
                    {ccaaShortLabel(opt.ccaaCode)}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </AnchoredPortal>
      <AnchoredPortal
        open={
          !interactionLocked &&
          open &&
          !loading &&
          text !== "" &&
          filtered.length === 0
        }
        anchorRef={inputRef}
        onDismiss={() => {
          setOpen(false);
          commitOrCancel();
        }}
        className="bg-background px-3 py-2"
        maxHeight={80}
      >
        <p className="text-xs text-muted-foreground">
          Ningún municipio coincide
        </p>
      </AnchoredPortal>
    </div>
  );
}
