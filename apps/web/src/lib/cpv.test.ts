import { describe, expect, it } from "vitest";
import {
  cpvCodesForSearch,
  cpvSearchPrefix,
  formatCpvListPreview,
  normalizeCpvCode,
} from "./cpv";

describe("normalizeCpvCode", () => {
  it("normaliza a 8 dígitos y descarta control", () => {
    expect(normalizeCpvCode("72000000-0")).toBe("72000000");
    expect(normalizeCpvCode("72")).toBe("72000000");
    expect(normalizeCpvCode("  3019  ")).toBe("30190000");
  });

  it("devuelve null si no hay dígitos", () => {
    expect(normalizeCpvCode("")).toBeNull();
    expect(normalizeCpvCode("abc")).toBeNull();
  });
});

describe("cpvSearchPrefix", () => {
  it("quita ceros finales para LIKE", () => {
    expect(cpvSearchPrefix("72000000")).toBe("72");
    expect(cpvSearchPrefix("3")).toBe("3");
    expect(cpvSearchPrefix("00000000")).toBe("0");
  });
});

describe("cpvCodesForSearch", () => {
  it("mapea códigos o undefined", () => {
    expect(cpvCodesForSearch(["72000000", "30190000"])).toEqual([
      "72",
      "3019",
    ]);
    expect(cpvCodesForSearch([])).toBeUndefined();
    expect(cpvCodesForSearch(undefined)).toBeUndefined();
  });
});

describe("formatCpvListPreview", () => {
  it("resume como máximo 2 códigos", () => {
    expect(formatCpvListPreview(null)).toBe("—");
    expect(formatCpvListPreview(["72000000"])).toBe("72000000");
    expect(formatCpvListPreview(["1", "2", "3"])).toBe("1, 2…");
  });
});
