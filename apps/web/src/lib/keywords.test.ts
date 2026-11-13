import { describe, expect, it } from "vitest";
import { normalizeSearchQuery, tokenizeKeywords } from "./keywords";

describe("tokenizeKeywords", () => {
  it("tokeniza y quita stopwords / tildes", () => {
    expect(tokenizeKeywords("Suministro de material de oficina")).toEqual([
      "suministro",
      "material",
      "oficina",
    ]);
    expect(tokenizeKeywords("Árboles y jardinería")).toEqual([
      "arboles",
      "jardineria",
    ]);
  });

  it("ignora ruido corto y duplicados", () => {
    expect(tokenizeKeywords("a el de")).toEqual([]);
    expect(tokenizeKeywords("agua agua")).toEqual(["agua"]);
    expect(tokenizeKeywords("")).toEqual([]);
  });
});

describe("normalizeSearchQuery", () => {
  it("une tokens útiles o deja vacío", () => {
    expect(normalizeSearchQuery("  Limpieza  de  colegios ")).toBe(
      "limpieza colegios",
    );
    expect(normalizeSearchQuery("de la")).toBe("");
  });
});
