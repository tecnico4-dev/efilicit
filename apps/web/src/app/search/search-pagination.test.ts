import { describe, expect, it } from "vitest";
import {
  parseSearchPageSize,
  SEARCH_PAGE_SIZE,
  SEARCH_RESULTS_ANCHOR,
  searchHref,
} from "./search-pagination";

const emptyFilters = {
  q: "",
  cpvCodes: [] as string[],
  cpvMatch: "any" as const,
  minRaw: "",
  maxRaw: "",
  ccaaCodes: [] as string[],
  municipality: "",
  statuses: [] as string[],
  procedures: [] as string[],
  contractTypes: [] as string[],
  pubFrom: "",
  pubTo: "",
  openForSubmission: true,
};

describe("parseSearchPageSize", () => {
  it("acepta tamaños válidos y cae al default", () => {
    expect(parseSearchPageSize("50")).toBe(50);
    expect(parseSearchPageSize("7")).toBe(SEARCH_PAGE_SIZE);
    expect(parseSearchPageSize("")).toBe(SEARCH_PAGE_SIZE);
  });
});

describe("searchHref", () => {
  it("preserva filtros, página y ancla", () => {
    const href = searchHref(
      {
        ...emptyFilters,
        q: "limpieza",
        statuses: ["PUB"],
        openForSubmission: false,
      },
      2,
      { withAnchor: true, pageSize: 20, sortBy: "title", sortDir: "asc" },
    );
    expect(href).toContain("/search?");
    expect(href).toContain("q=limpieza");
    expect(href).toContain("status=PUB");
    expect(href).toContain("en_plazo=0");
    expect(href).toContain("page=2");
    expect(href).toContain("ps=20");
    expect(href).toContain("sort=title");
    expect(href).toContain("dir=asc");
    expect(href.endsWith(`#${SEARCH_RESULTS_ANCHOR}`)).toBe(true);
  });

  it("sin filtros ni página queda en /search", () => {
    expect(searchHref(emptyFilters, 1)).toBe("/search?en_plazo=1");
  });
});
