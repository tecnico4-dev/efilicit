import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  countActiveFavoriteFilters,
  tenderMatchesFavoriteFilters,
} from "./favorites-list-filter";
import type { SearchCriteria } from "@efilicit/types";

const tender = {
  title: "Limpieza de colegios públicos",
  status: "publicada",
  procedure_type: "abierto",
  contract_type: "servicios",
  estimated_value: 25000,
  cpv_codes: ["90910000"],
  publication_date: "2026-05-01",
  deadline_at: "2026-12-01T12:00:00+01:00",
};

describe("countActiveFavoriteFilters", () => {
  it("cuenta bloques activos", () => {
    expect(countActiveFavoriteFilters(null)).toBe(0);
    expect(
      countActiveFavoriteFilters({
        version: 1,
        keywords: ["x"],
        cpv_codes: ["1"],
        open_for_submission: true,
      }),
    ).toBe(3);
  });
});

describe("tenderMatchesFavoriteFilters", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-11-12T11:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sin criteria deja pasar; sin tender falla", () => {
    expect(tenderMatchesFavoriteFilters(tender, null)).toBe(true);
    expect(tenderMatchesFavoriteFilters(null, { version: 1, keywords: ["x"] })).toBe(
      false,
    );
  });

  it("filtra por texto, CPV, importe y estado", () => {
    const criteria: SearchCriteria = {
      version: 1,
      keywords: ["limpieza", "colegios"],
      cpv_codes: ["9091"],
      estimated_value_min: 10000,
      estimated_value_max: 30000,
      statuses: ["publicada"],
    };
    expect(tenderMatchesFavoriteFilters(tender, criteria)).toBe(true);
    expect(
      tenderMatchesFavoriteFilters(tender, {
        ...criteria,
        keywords: ["fontaneria"],
      }),
    ).toBe(false);
    expect(
      tenderMatchesFavoriteFilters(tender, {
        ...criteria,
        estimated_value_min: 50000,
      }),
    ).toBe(false);
  });

  it("open_for_submission exige deadline futuro", () => {
    expect(
      tenderMatchesFavoriteFilters(tender, {
        version: 1,
        open_for_submission: true,
      }),
    ).toBe(true);
    expect(
      tenderMatchesFavoriteFilters(
        { ...tender, deadline_at: "2026-11-01T12:00:00+01:00" },
        { version: 1, open_for_submission: true },
      ),
    ).toBe(false);
  });
});
