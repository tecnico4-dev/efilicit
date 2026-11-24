import type { PipelineViewMode } from "@/components/mis-licitaciones/pipeline-board";

export type MisLicitacionesNavScope = "active" | "historic";

export type MisLicitacionesNavState = {
  scope: MisLicitacionesNavScope;
  view: PipelineViewMode;
};

export const DEFAULT_MIS_LICITACIONES_NAV: MisLicitacionesNavState = {
  scope: "active",
  view: "lista",
};

const STORAGE_KEY = "efilicit:mis-licitaciones-nav";

function isView(v: unknown): v is PipelineViewMode {
  return v === "lista" || v === "kanban";
}

function isScope(v: unknown): v is MisLicitacionesNavScope {
  return v === "active" || v === "historic";
}

export function loadMisLicitacionesNav(): MisLicitacionesNavState {
  if (typeof window === "undefined") return DEFAULT_MIS_LICITACIONES_NAV;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MIS_LICITACIONES_NAV;
    const parsed = JSON.parse(raw) as Partial<MisLicitacionesNavState>;
    return {
      scope: isScope(parsed.scope) ? parsed.scope : "active",
      view: isView(parsed.view) ? parsed.view : "lista",
    };
  } catch {
    return DEFAULT_MIS_LICITACIONES_NAV;
  }
}

export function saveMisLicitacionesNav(
  next: Partial<MisLicitacionesNavState>,
): MisLicitacionesNavState {
  const current = loadMisLicitacionesNav();
  const merged: MisLicitacionesNavState = {
    scope: next.scope ?? current.scope,
    view: next.view ?? current.view,
  };
  if (typeof window === "undefined") return merged;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    /* ignore quota / private mode */
  }
  return merged;
}

/** Al salir del área `/mis-licitaciones` (no al abrir un expediente). */
export function clearMisLicitacionesNavStorage(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Href de listado según la sesión (Activas/Lista si no hay nada). */
export function misLicitacionesListHref(
  state: MisLicitacionesNavState = loadMisLicitacionesNav(),
): string {
  return state.scope === "historic"
    ? "/mis-licitaciones?tab=historic"
    : "/mis-licitaciones";
}
