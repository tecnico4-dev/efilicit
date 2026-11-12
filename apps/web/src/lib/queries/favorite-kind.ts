/** Clasificación Eficen / Subcontrata (favoritos personales y Común). */

export type FavoriteKind = "propia" | "subcontrata";

export function asFavoriteKind(raw: string | null | undefined): FavoriteKind | null {
  if (raw === "propia" || raw === "subcontrata") return raw;
  return null;
}

export function favoriteKindLabel(kind: FavoriteKind): string {
  return kind === "propia" ? "Eficen" : "Subcontrata";
}

export function favoriteKindLongLabel(kind: FavoriteKind): string {
  return kind === "propia" ? "Propias de Eficen" : "Subcontrata";
}
