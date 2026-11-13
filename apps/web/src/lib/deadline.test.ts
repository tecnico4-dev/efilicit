import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  attentionFavorites,
  deadlineLabel,
  deadlineUrgencyClass,
  daysUntilDeadlineMadrid,
} from "./deadline";
import type { FavoriteWithTender } from "@/lib/queries";

function fav(
  id: string,
  deadline_at: string | null,
): FavoriteWithTender {
  return {
    id,
    user_id: "u1",
    tender_id: id,
    created_at: "2026-01-01T00:00:00Z",
    kind: "propia",
    tenders: {
      id,
      title: `Tender ${id}`,
      status: "publicada",
      procedure_type: "abierto",
      contract_type: "servicios",
      estimated_value: 1000,
      currency: "EUR",
      deadline_at,
      publication_date: null,
      cpv_codes: [],
    },
  } as FavoriteWithTender;
}

describe("deadline helpers", () => {
  beforeEach(() => {
    // Miércoles 12 nov 2026 12:00 Madrid ≈ 11:00 UTC
    vi.setSystemTime(new Date("2026-11-12T11:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("daysUntilDeadlineMadrid calcula días civiles", () => {
    expect(daysUntilDeadlineMadrid(null)).toBeNull();
    expect(daysUntilDeadlineMadrid("2026-11-12T20:00:00+01:00")).toBe(0);
    expect(daysUntilDeadlineMadrid("2026-11-13T10:00:00+01:00")).toBe(1);
    expect(daysUntilDeadlineMadrid("2026-11-10T10:00:00+01:00")).toBe(-2);
  });

  it("deadlineLabel cubre hoy / mañana / pasado / vencido", () => {
    expect(deadlineLabel(null)).toBe("Sin plazo");
    expect(deadlineLabel("2026-11-12T18:00:00+01:00")).toBe("Vence hoy");
    expect(deadlineLabel("2026-11-13T18:00:00+01:00")).toBe("Vence mañana");
    expect(deadlineLabel("2026-11-20T18:00:00+01:00")).toBe("Vence en 8 días");
    expect(deadlineLabel("2026-11-09T18:00:00+01:00")).toBe("Venció hace 3 d");
  });

  it("deadlineUrgencyClass marca vencidas y ≤7 días", () => {
    expect(deadlineUrgencyClass(null)).toBe("text-muted-foreground");
    expect(deadlineUrgencyClass("2026-11-09T12:00:00+01:00")).toBe(
      "text-destructive",
    );
    expect(deadlineUrgencyClass("2026-11-15T12:00:00+01:00")).toBe(
      "text-primary-dark",
    );
    expect(deadlineUrgencyClass("2026-12-01T12:00:00+01:00")).toBe(
      "text-muted-foreground",
    );
  });

  it("attentionFavorites ordena, filtra vencidas >5d y corta a 5", () => {
    const rows = attentionFavorites([
      fav("no-plazo", null),
      fav("lejos", "2026-12-01T12:00:00+01:00"),
      fav("manana", "2026-11-13T12:00:00+01:00"),
      fav("ayer", "2026-11-11T12:00:00+01:00"),
      fav("muy-vieja", "2026-10-01T12:00:00+01:00"),
      fav("hoy", "2026-11-12T12:00:00+01:00"),
      fav("en-3", "2026-11-15T12:00:00+01:00"),
      fav("en-2", "2026-11-14T12:00:00+01:00"),
    ]);
    expect(rows.map((r) => r.id)).toEqual([
      "hoy",
      "manana",
      "en-2",
      "en-3",
      "lejos",
    ]);
    expect(rows).toHaveLength(5);
    expect(rows.find((r) => r.id === "muy-vieja")).toBeUndefined();
    expect(rows.find((r) => r.id === "no-plazo")).toBeUndefined();
  });
});
