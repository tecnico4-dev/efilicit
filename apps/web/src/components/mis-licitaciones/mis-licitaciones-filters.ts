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

/**
 * Filtros por pestaña (Activas e Histórico independientes).
 * Persisten al ir y volver; no se traspasan entre pestañas.
 */
export const MIS_LICITACIONES_FILTERS_STORAGE_KEY =
  "efilicit:mis-licitaciones-filters-by-scope";

type FiltersByScope = {
  active: MisLicitacionesFilters;
  historic: MisLicitacionesFilters;
};

function parseFiltersBlob(
  raw: Partial<MisLicitacionesFilters> | null | undefined,
): MisLicitacionesFilters {
  if (!raw || typeof raw !== "object") return EMPTY_MIS_LICITACIONES_FILTERS;
  return {
    year: typeof raw.year === "number" ? raw.year : null,
    stages: Array.isArray(raw.stages)
      ? (raw.stages.filter(
          (s) => typeof s === "string",
        ) as MisLicitacionesFilters["stages"])
      : [],
    amountMin: typeof raw.amountMin === "number" ? raw.amountMin : null,
    amountMax: typeof raw.amountMax === "number" ? raw.amountMax : null,
    ownerKey: typeof raw.ownerKey === "string" ? raw.ownerKey : "",
  };
}

function readFiltersByScope(): FiltersByScope {
  const empty: FiltersByScope = {
    active: EMPTY_MIS_LICITACIONES_FILTERS,
    historic: EMPTY_MIS_LICITACIONES_FILTERS,
  };
  if (typeof window === "undefined") return empty;
  try {
    const raw = sessionStorage.getItem(MIS_LICITACIONES_FILTERS_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<FiltersByScope>;
    return {
      active: parseFiltersBlob(parsed.active),
      historic: parseFiltersBlob(parsed.historic),
    };
  } catch {
    return empty;
  }
}

export function loadMisLicitacionesFiltersForScope(
  scope: "active" | "historic",
): MisLicitacionesFilters {
  return readFiltersByScope()[scope];
}

export function saveMisLicitacionesFiltersForScope(
  scope: "active" | "historic",
  f: MisLicitacionesFilters,
): void {
  if (typeof window === "undefined") return;
  try {
    const all = readFiltersByScope();
    all[scope] = f;
    sessionStorage.setItem(
      MIS_LICITACIONES_FILTERS_STORAGE_KEY,
      JSON.stringify(all),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

/** Al salir del área `/mis-licitaciones` (no al abrir un expediente). */
export function clearMisLicitacionesFiltersStorage(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(MIS_LICITACIONES_FILTERS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function isMisLicitacionesPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === "/mis-licitaciones" ||
    pathname.startsWith("/mis-licitaciones/")
  );
}

export const OWNER_NONE_KEY = "__none__";

export function countActiveMisLicitacionesFilters(
  f: MisLicitacionesFilters,
  scope: "active" | "historic" = "historic",
): number {
  let n = 0;
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
