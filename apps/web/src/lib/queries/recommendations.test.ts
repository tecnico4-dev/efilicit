import { describe, expect, it } from "vitest";
import { createFakeSupabaseClient } from "@/test/fake-supabase";
import { listOwnRecommendations } from "./recommendations";

describe("listOwnRecommendations", () => {
  it("agrupa por perfil, aplica limit y oculta valoradas/favoritas", async () => {
    const client = createFakeSupabaseClient({
      tables: {
        tender_recommendations: {
          byMethod: {
            select: {
              data: [
                {
                  tender_id: "t1",
                  profile_kind: "propia",
                  score: 0.9,
                  reason: { label: "CPV 71314000" },
                  computed_at: "2026-11-17T10:00:00Z",
                  tenders: {
                    title: "Alumbrado",
                    deadline_at: "2026-12-01T12:00:00Z",
                    estimated_value: 10000,
                    currency: "EUR",
                  },
                },
                {
                  tender_id: "t2",
                  profile_kind: "propia",
                  score: 0.8,
                  reason: { label: "Parecida" },
                  computed_at: "2026-11-17T10:00:00Z",
                  tenders: {
                    title: "Oculta",
                    deadline_at: null,
                    estimated_value: null,
                    currency: "EUR",
                  },
                },
                {
                  tender_id: "t3",
                  profile_kind: "subcontrata",
                  score: 0.7,
                  reason: {},
                  computed_at: "2026-11-17T09:00:00Z",
                  tenders: {
                    title: "Obra",
                    deadline_at: null,
                    estimated_value: null,
                    currency: "EUR",
                  },
                },
              ],
            },
          },
        },
        tender_ratings: {
          byMethod: {
            select: { data: [{ tender_id: "t2" }] },
          },
        },
        favorites: {
          byMethod: {
            select: { data: [] },
          },
        },
      },
    });

    const { data, error } = await listOwnRecommendations(client as never, {
      userId: "u1",
      limitPerKind: 5,
    });
    expect(error).toBeNull();
    expect(data.propia.map((r) => r.tenderId)).toEqual(["t1"]);
    expect(data.propia[0]?.reasonLabel).toBe("CPV 71314000");
    expect(data.subcontrata).toHaveLength(1);
    expect(data.subcontrata[0]?.reasonLabel).toBe(
      "Recomendada según tu interés",
    );
    expect(data.computedAt).toBe("2026-11-17T10:00:00Z");
  });
});
