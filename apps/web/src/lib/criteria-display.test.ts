import { describe, expect, it } from "vitest";
import {
  criteriaEqual,
  criteriaHasFilters,
  criteriaSignature,
  criteriaToFilterInitial,
  formatCriteriaSummary,
  parseCriteria,
} from "./criteria-display";
import type { SearchCriteria } from "@efilicit/types";

const sample: SearchCriteria = {
  version: 1,
  keywords: ["limpieza", "colegios"],
  cpv_codes: ["90910000", "90911000", "90912000"],
  cpv_match: "all",
  estimated_value_min: 1000,
  estimated_value_max: 5000,
  statuses: ["publicada"],
  procedure_types: ["abierto"],
  contract_types: ["servicios"],
  publication_date_from: "2026-01-01",
  publication_date_to: "2026-06-30",
  open_for_submission: true,
  geography: {
    ccaa_codes: ["13"],
    municipality_codes: ["28079"],
  },
};

describe("parseCriteria", () => {
  it("acepta v1 y rechaza basura", () => {
    expect(parseCriteria(sample)).toEqual(sample);
    expect(parseCriteria(null)).toEqual({ version: 1 });
    expect(parseCriteria({ version: 2 })).toEqual({ version: 1 });
    expect(parseCriteria([])).toEqual({ version: 1 });
  });
});

describe("formatCriteriaSummary", () => {
  it("resume campos con separador ~", () => {
    const summary = formatCriteriaSummary(sample, {
      municipalityNames: { "28079": "Madrid" },
    });
    expect(summary).toContain('Texto: "limpieza colegios"');
    expect(summary).toContain("CPV (todos): 90910000, 90911000…");
    expect(summary).toContain("Lugar:");
    expect(summary).toContain("Madrid");
    expect(summary).toContain("Estado: Publicada");
    expect(summary).toContain("Importe: [1000-5000]€");
    expect(summary).toContain("Fecha: [01/01/2026-30/06/2026]");
    expect(summary).toContain("Solo en plazo: sí");
    expect(summary.split(" ~ ").length).toBeGreaterThan(5);
  });

  it("sin criterios", () => {
    expect(formatCriteriaSummary({ version: 1 })).toBe("Sin criterios");
  });
});

describe("criteriaSignature / equal", () => {
  it("ignora orden de arrays", () => {
    const a: SearchCriteria = {
      version: 1,
      keywords: ["b", "a"],
      cpv_codes: ["2", "1"],
    };
    const b: SearchCriteria = {
      version: 1,
      keywords: ["a", "b"],
      cpv_codes: ["1", "2"],
    };
    expect(criteriaSignature(a)).toBe(criteriaSignature(b));
    expect(criteriaEqual(a, b)).toBe(true);
  });
});

describe("criteriaToFilterInitial / hasFilters", () => {
  it("hidrata el formulario compartido", () => {
    const initial = criteriaToFilterInitial(sample);
    expect(initial.q).toBe("limpieza colegios");
    expect(initial.cpvMatch).toBe("all");
    expect(initial.min).toBe("1000");
    expect(initial.ccaaCodes).toEqual(["13"]);
    expect(initial.openForSubmission).toBe(true);
    expect(criteriaHasFilters(sample)).toBe(true);
    expect(criteriaHasFilters({ version: 1 })).toBe(false);
  });
});
