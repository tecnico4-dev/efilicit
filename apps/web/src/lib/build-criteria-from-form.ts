/**
 * Lee un `<form>` con los `name` del buscador/alertas y construye Criteria v1.
 */
import type { SearchCriteria } from "@efilicit/types";
import { tokenizeKeywords } from "@/lib/keywords";
import { normalizeCpvCode } from "@/lib/cpv";

function readField(form: HTMLFormElement, name: string): string {
  const el = form.elements.namedItem(name);
  if (el instanceof RadioNodeList) {
    return String(el.value ?? "").trim();
  }
  if (el instanceof HTMLInputElement) {
    if (el.type === "checkbox") return el.checked ? el.value.trim() || "1" : "";
    return el.value.trim();
  }
  if (el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
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

/**
 * Criteria v1 desde el formulario compartido (búsqueda / alertas).
 * `null` si no hay ningún filtro (anti-spam / no guardar vacío).
 */
export function buildCriteriaFromSearchForm(
  form: HTMLFormElement,
): SearchCriteria | null {
  const q = readField(form, "q");
  const cpvRaw = readAllFields(form, "cpv");
  const cpvCodes = [
    ...new Set(
      cpvRaw
        .map((c) => normalizeCpvCode(c))
        .filter((c): c is string => Boolean(c)),
    ),
  ];
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

export function hasInvalidPublicationRange(form: HTMLFormElement): boolean {
  const from = readField(form, "pub_from");
  const to = readField(form, "pub_to");
  if (from === "" || to === "") return false;
  return from > to;
}

export function hasInvalidAmountRange(form: HTMLFormElement): boolean {
  const minRaw = readField(form, "min");
  const maxRaw = readField(form, "max");
  if (minRaw === "" || maxRaw === "") return false;
  const min = Number(minRaw);
  const max = Number(maxRaw);
  if (Number.isNaN(min) || Number.isNaN(max)) return false;
  return min > max;
}
