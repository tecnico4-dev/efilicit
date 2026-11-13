import { describe, expect, it } from "vitest";
import { sortSearchFilterOptions } from "./list-search-filter-options";

describe("sortSearchFilterOptions", () => {
  it("ordena alfabético ES y deja Otro al final", () => {
    const sorted = sortSearchFilterOptions([
      { value: "otro", label: "Otro" },
      { value: "servicios", label: "Servicios" },
      { value: "obras", label: "Obras" },
      { value: "suministros", label: "Suministros" },
    ]);
    expect(sorted.map((o) => o.label)).toEqual([
      "Obras",
      "Servicios",
      "Suministros",
      "Otro",
    ]);
  });
});
