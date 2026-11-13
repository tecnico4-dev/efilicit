import { describe, expect, it } from "vitest";
import {
  asFavoriteKind,
  favoriteKindLabel,
  favoriteKindLongLabel,
} from "./favorite-kind";

describe("asFavoriteKind", () => {
  it("acepta valores conocidos", () => {
    expect(asFavoriteKind("propia")).toBe("propia");
    expect(asFavoriteKind("subcontrata")).toBe("subcontrata");
  });

  it("rechaza inválidos", () => {
    expect(asFavoriteKind(null)).toBeNull();
    expect(asFavoriteKind("")).toBeNull();
    expect(asFavoriteKind("otro")).toBeNull();
  });
});

describe("favoriteKind labels", () => {
  it("etiqueta corta y larga", () => {
    expect(favoriteKindLabel("propia")).toBe("Eficen");
    expect(favoriteKindLabel("subcontrata")).toBe("Subcontrata");
    expect(favoriteKindLongLabel("propia")).toBe("Propias de Eficen");
  });
});
