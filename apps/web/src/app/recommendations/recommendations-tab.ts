import type { FavoriteKind } from "@/lib/queries";

export type RecommendationsTab = "todas" | FavoriteKind;

export function parseRecommendationsTab(
  raw: string | null | undefined,
): RecommendationsTab {
  if (raw === "propia" || raw === "subcontrata") return raw;
  return "todas";
}
