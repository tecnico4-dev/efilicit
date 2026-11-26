import { describe, expect, it } from "vitest";
import {
  DEFAULT_SEARCH_SORT_BY,
  DEFAULT_SEARCH_SORT_DIR,
  parseSearchSortBy,
  parseSearchSortDir,
  searchSortLabel,
} from "./search-sort";

describe("parseSearchSortBy", () => {
  it("acepta valores conocidos e ignora basura", () => {
    expect(parseSearchSortBy("deadline_at")).toBe("deadline_at");
    expect(parseSearchSortBy(" TITLE ")).toBe("title");
    expect(parseSearchSortBy("nope")).toBe(DEFAULT_SEARCH_SORT_BY);
  });
});

describe("parseSearchSortDir", () => {
  it("acepta asc/desc", () => {
    expect(parseSearchSortDir("asc")).toBe("asc");
    expect(parseSearchSortDir("DESC")).toBe("desc");
    expect(parseSearchSortDir("sideways")).toBe(DEFAULT_SEARCH_SORT_DIR);
  });
});

describe("searchSortLabel", () => {
  it("devuelve etiqueta legible", () => {
    expect(searchSortLabel("estimated_value")).toBe("Importe");
    expect(searchSortLabel("relevance")).toBe("Relevancia");
  });
});
