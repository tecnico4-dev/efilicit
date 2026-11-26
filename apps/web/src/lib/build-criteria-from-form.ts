/**
 * Lee un `<form>` con los `name` del buscador/alertas y construye Criteria v1.
 */
import type { SearchCriteria } from "@efilicit/types";
import { tokenizeKeywords } from "@/lib/keywords";
import { normalizeCpvCode } from "@/lib/cpv";

function readField(form: HTMLFormElement, name: string): string {
  const el = form.elements.namedItem(name);
  if (el instanceof RadioNodeList) {
    for (const node of el) {
      if (node instanceof HTMLInputElement && node.value.trim() !== "") {
        return node.value.trim();
      }
    }
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
  const ccaaCodes = readAllFields(form, "ccaa");
  const municipality = readField(form, "municipality");
  const statuses = readAllFields(form, "status");
  const procedureTypes = readAllFields(form, "procedure");
  const contractTypes = readAllFields(form, "contract_type");
  const pubFrom = readField(form, "pub_from");
  const pubTo = readField(form, "pub_to");
  const openForSubmission = readField(form, "en_plazo") === "1";
  const min = minRaw === "" ? undefined : Number(minRaw);
  const max = maxRaw === "" ? undefined : Number(maxRaw);

  const keywords = q ? tokenizeKeywords(q) : undefined;

  // «Solo en plazo» es default: no basta para guardar / considerar criterios.
  const hasSomething =
    (keywords && keywords.length > 0) ||
    cpvCodes.length > 0 ||
    (min != null && !Number.isNaN(min)) ||
    (max != null && !Number.isNaN(max)) ||
    ccaaCodes.length > 0 ||
    municipality !== "" ||
    statuses.length > 0 ||
    procedureTypes.length > 0 ||
    contractTypes.length > 0 ||
    pubFrom !== "" ||
    pubTo !== "";

  if (!hasSomething) return null;

  return {
    version: 1,
    keywords: keywords?.length ? keywords : undefined,
    cpv_codes: cpvCodes.length ? cpvCodes : undefined,
    cpv_match: cpvMatch,
    estimated_value_min: min != null && !Number.isNaN(min) ? min : undefined,
    estimated_value_max: max != null && !Number.isNaN(max) ? max : undefined,
    statuses: statuses.length ? statuses : undefined,
    procedure_types: procedureTypes.length ? procedureTypes : undefined,
    contract_types: contractTypes.length ? contractTypes : undefined,
    publication_date_from: pubFrom || undefined,
    publication_date_to: pubTo || undefined,
    open_for_submission: openForSubmission,
    geography:
      ccaaCodes.length > 0 || municipality
        ? {
            ccaa_codes: ccaaCodes.length ? ccaaCodes : undefined,
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

/**
 * «Solo en plazo» va marcado por defecto: no cuenta como criterio por sí solo.
 */
export function hasAnyCriterion(form: HTMLFormElement): boolean {
  const names = [
    "q",
    "cpv",
    "min",
    "max",
    "ccaa",
    "municipality",
    "status",
    "procedure",
    "contract_type",
    "pub_from",
    "pub_to",
  ] as const;
  return names.some((name) => {
    if (
      name === "ccaa" ||
      name === "status" ||
      name === "procedure" ||
      name === "contract_type"
    ) {
      const el = form.elements.namedItem(name);
      if (el instanceof RadioNodeList) {
        return [...el].some(
          (node) =>
            node instanceof HTMLInputElement && node.value.trim() !== "",
        );
      }
    }
    return readField(form, name) !== "";
  });
}

/** Checkbox desmarcado no viaja en GET: inyectamos `en_plazo=0`. */
export function ensureEnPlazoParam(form: HTMLFormElement) {
  const el = form.elements.namedItem("en_plazo");
  const checked = el instanceof HTMLInputElement && el.checked;
  form.querySelectorAll('input[data-en-plazo-off="1"]').forEach((n) => n.remove());
  if (!checked) {
    const hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.name = "en_plazo";
    hidden.value = "0";
    hidden.dataset.enPlazoOff = "1";
    form.appendChild(hidden);
  }
}
