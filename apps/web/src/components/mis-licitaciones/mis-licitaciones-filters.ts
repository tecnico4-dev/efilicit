import {
  ACTIVE_OFFER_STAGES,
  HISTORIC_OFFER_STAGES,
  offerCaseHistoryYear,
  type OfferCaseListItem,
  type OfferStage,
} from "@/lib/queries";

export type MisLicitacionesFilters = {
  /** Solo aplica en Histórico; null = todos. */
  year: number | null;
  stages: OfferStage[];
  amountMin: number | null;
  amountMax: number | null;
  /** `""` = sin filtrar; `"__none__"` = sin responsable; otro = owner_name exacto. */
  ownerKey: string;
};

export const EMPTY_MIS_LICITACIONES_FILTERS: MisLicitacionesFilters = {
  year: null,
  stages: [],
  amountMin: null,
  amountMax: null,
  ownerKey: "",
};

/** Persiste al cambiar Activas ↔ Histórico (navegación remonta el cliente). */
export const MIS_LICITACIONES_FILTERS_STORAGE_KEY =
  "efilicit:mis-licitaciones-filters";

/** `null` si aún no hay nada guardado en la sesión. */
export function loadMisLicitacionesFilters(): MisLicitacionesFilters | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(MIS_LICITACIONES_FILTERS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MisLicitacionesFilters>;
    return {
      year: typeof parsed.year === "number" ? parsed.year : null,
      stages: Array.isArray(parsed.stages)
        ? (parsed.stages.filter(
            (s) => typeof s === "string",
          ) as MisLicitacionesFilters["stages"])
        : [],
      amountMin: typeof parsed.amountMin === "number" ? parsed.amountMin : null,
      amountMax: typeof parsed.amountMax === "number" ? parsed.amountMax : null,
      ownerKey: typeof parsed.ownerKey === "string" ? parsed.ownerKey : "",
    };
  } catch {
    return null;
  }
}

export function saveMisLicitacionesFilters(f: MisLicitacionesFilters): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(MIS_LICITACIONES_FILTERS_STORAGE_KEY, JSON.stringify(f));
  } catch {
    /* ignore quota / private mode */
  }
}

export const OWNER_NONE_KEY = "__none__";

export function countActiveMisLicitacionesFilters(
  f: MisLicitacionesFilters,
  scope: "active" | "historic" = "historic",
): number {
  let n = 0;
  // El año solo aplica en Histórico; se conserva en estado al ir a Activas.
  if (scope === "historic" && f.year != null) n += 1;
  if (f.stages.length > 0) n += 1;
  if (f.amountMin != null) n += 1;
  if (f.amountMax != null) n += 1;
  if (f.ownerKey) n += 1;
  return n;
}

export function stagesForScope(scope: "active" | "historic"): OfferStage[] {
  return scope === "historic"
    ? [...HISTORIC_OFFER_STAGES]
    : [...ACTIVE_OFFER_STAGES];
}

export function ownerOptionsFromCases(
  cases: OfferCaseListItem[],
): { value: string; label: string }[] {
  const names = new Set<string>();
  let hasNone = false;
  for (const c of cases) {
    const name = c.owner_name?.trim();
    if (!name) hasNone = true;
    else names.add(name);
  }
  const opts = [...names]
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((name) => ({ value: name, label: name }));
  if (hasNone) {
    opts.unshift({ value: OWNER_NONE_KEY, label: "Sin asignar" });
  }
  return opts;
}

export function applyMisLicitacionesFilters(
  cases: OfferCaseListItem[],
  scope: "active" | "historic",
  f: MisLicitacionesFilters,
): OfferCaseListItem[] {
  return cases.filter((c) => {
    if (scope === "historic" && f.year != null) {
      if (offerCaseHistoryYear(c) !== f.year) return false;
    }
    if (f.stages.length > 0) {
      if (!(f.stages as string[]).includes(c.stage)) return false;
    }
    const amount = c.tenders?.estimated_value ?? null;
    if (f.amountMin != null) {
      if (amount == null || amount < f.amountMin) return false;
    }
    if (f.amountMax != null) {
      if (amount == null || amount > f.amountMax) return false;
    }
    if (f.ownerKey === OWNER_NONE_KEY) {
      if (c.owner_name?.trim()) return false;
    } else if (f.ownerKey) {
      if ((c.owner_name?.trim() ?? "") !== f.ownerKey) return false;
    }
    return true;
  });
}
