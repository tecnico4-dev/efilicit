/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  FAVORITES_LAST_SECTION_KEY,
  favoritesSectionFromPath,
  favoritesSectionHref,
  readFavoritesLastSection,
  writeFavoritesLastSection,
} from "./favorites-last-section";

describe("favorites section helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("href y path", () => {
    expect(favoritesSectionHref("tenders")).toBe("/favorites/tenders");
    expect(favoritesSectionHref("common")).toBe("/favorites/common");
    expect(favoritesSectionHref("shared")).toBe("/favorites/shared");
    expect(favoritesSectionHref("searches")).toBe("/favorites/searches");
    expect(favoritesSectionFromPath("/favorites/common")).toBe("common");
    expect(favoritesSectionFromPath("/favorites/shared")).toBe("shared");
    expect(favoritesSectionFromPath("/favorites/searches/x")).toBe("searches");
    expect(favoritesSectionFromPath("/favorites/tenders")).toBe("tenders");
    expect(favoritesSectionFromPath("/home")).toBeNull();
  });

  it("lee y escribe última sección en localStorage", () => {
    expect(readFavoritesLastSection()).toBe("tenders");
    writeFavoritesLastSection("shared");
    expect(window.localStorage.getItem(FAVORITES_LAST_SECTION_KEY)).toBe(
      "shared",
    );
    expect(readFavoritesLastSection()).toBe("shared");
    window.localStorage.setItem(FAVORITES_LAST_SECTION_KEY, "basura");
    expect(readFavoritesLastSection()).toBe("tenders");
  });
});
