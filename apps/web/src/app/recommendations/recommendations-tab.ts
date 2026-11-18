import type { FavoriteKind } from "@/lib/queries";

export type RecommendationsTab = "todas" | FavoriteKind;

export type RecommendationsViewMode = "lista" | "kanban";

export function parseRecommendationsTab(
  raw: string | null | undefined,
): RecommendationsTab {
  if (raw === "propia" || raw === "subcontrata") return raw;
  return "todas";
}

export function parseRecommendationsView(
  raw: string | null | undefined,
): RecommendationsViewMode {
  return raw === "kanban" ? "kanban" : "lista";
}

/** URL de /recommendations (lista+todas = sin query; kanban omite tab). */
export function recommendationsHref(opts?: {
  tab?: RecommendationsTab;
  view?: RecommendationsViewMode;
}): string {
  const qs = new URLSearchParams();
  if (opts?.view === "kanban") {
    qs.set("view", "kanban");
  } else if (opts?.tab === "propia" || opts?.tab === "subcontrata") {
    qs.set("tab", opts.tab);
  }
  const s = qs.toString();
  return s ? `/recommendations?${s}` : "/recommendations";
}
