/** Última sección de Favoritos (localStorage; solo cliente). */

export const FAVORITES_LAST_SECTION_KEY = "efilicit.favorites.lastSection";

export type FavoritesSection = "tenders" | "common" | "searches";

export function favoritesSectionHref(section: FavoritesSection): string {
  if (section === "common") return "/favorites/common";
  if (section === "searches") return "/favorites/searches";
  return "/favorites/tenders";
}

export function favoritesSectionFromPath(pathname: string): FavoritesSection | null {
  if (
    pathname === "/favorites/common" ||
    pathname.startsWith("/favorites/common/")
  ) {
    return "common";
  }
  if (
    pathname === "/favorites/searches" ||
    pathname.startsWith("/favorites/searches/")
  ) {
    return "searches";
  }
  if (
    pathname === "/favorites/tenders" ||
    pathname.startsWith("/favorites/tenders/")
  ) {
    return "tenders";
  }
  return null;
}

export function readFavoritesLastSection(): FavoritesSection {
  if (typeof window === "undefined") return "tenders";
  try {
    const raw = window.localStorage.getItem(FAVORITES_LAST_SECTION_KEY);
    if (raw === "common" || raw === "searches" || raw === "tenders") {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return "tenders";
}

export function writeFavoritesLastSection(section: FavoritesSection): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FAVORITES_LAST_SECTION_KEY, section);
  } catch {
    /* ignore */
  }
}
