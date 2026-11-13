import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calendarDayMadrid,
  formatDateMadrid,
  formatDateTimeMadrid,
  formatRelativeDayMadrid,
} from "./datetime";

describe("datetime Madrid", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-11-12T11:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calendarDayMadrid en Europe/Madrid", () => {
    expect(calendarDayMadrid("2026-11-12T00:30:00+01:00")).toBe("2026-11-12");
    expect(calendarDayMadrid("invalid")).toBeNull();
  });

  it("formatDateMadrid / formatDateTimeMadrid", () => {
    expect(formatDateMadrid(null)).toBe("—");
    expect(formatDateMadrid("nope")).toBe("—");
    expect(formatDateMadrid("2026-06-07T10:00:00Z")).toMatch(/2026/);
    expect(formatDateTimeMadrid("2026-06-07T10:00:00Z")).toMatch(/:/);
  });

  it("formatRelativeDayMadrid Hoy / Ayer / absoluto", () => {
    expect(formatRelativeDayMadrid(null)).toBe("—");
    expect(formatRelativeDayMadrid("2026-11-12T15:00:00+01:00")).toBe("Hoy");
    expect(formatRelativeDayMadrid("2026-11-11T15:00:00+01:00")).toBe("Ayer");
    expect(formatRelativeDayMadrid("2026-06-07T10:00:00Z")).toMatch(/2026/);
  });
});
