import { describe, expect, it } from "vitest";
import { createFakeSupabaseClient } from "@/test/fake-supabase";
import {
  hasOwnVisibleRecommendations,
  listOwnRecommendations,
} from "./recommendations";

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
                    status: "published",
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
                    status: null,
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
                    status: "awarded",
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
    expect(data.propia[0]?.status).toBe("published");
    expect(data.subcontrata).toHaveLength(1);
    expect(data.subcontrata[0]?.reasonLabel).toBe(
      "Recomendada según tu interés",
    );
    expect(data.sinPerfil).toEqual([]);
    expect(data.computedAt).toBe("2026-11-17T10:00:00Z");
  });

  it("agrupa profile_kind null en sinPerfil", async () => {
    const client = createFakeSupabaseClient({
      tables: {
        tender_recommendations: {
          byMethod: {
            select: {
              data: [
                {
                  tender_id: "t9",
                  profile_kind: null,
                  score: 0.85,
                  reason: { tie_profiles: true },
                  computed_at: "2026-11-18T10:00:00Z",
                  tenders: {
                    title: "Empate",
                    status: null,
                    deadline_at: null,
                    estimated_value: null,
                    currency: "EUR",
                  },
                },
              ],
            },
          },
        },
        tender_ratings: { byMethod: { select: { data: [] } } },
        favorites: { byMethod: { select: { data: [] } } },
      },
    });
    const { data, error } = await listOwnRecommendations(client as never, {
      userId: "u1",
    });
    expect(error).toBeNull();
    expect(data.propia).toEqual([]);
    expect(data.subcontrata).toEqual([]);
    expect(data.sinPerfil.map((r) => r.tenderId)).toEqual(["t9"]);
    expect(data.sinPerfil[0]?.profileKind).toBeNull();
  });

  it("hasOwnVisibleRecommendations ignora valoradas/favoritas", async () => {
    const client = createFakeSupabaseClient({
      tables: {
        tender_recommendations: {
          byMethod: {
            select: {
              data: [{ tender_id: "t1" }, { tender_id: "t2" }],
            },
          },
        },
        tender_ratings: {
          byMethod: {
            select: { data: [{ tender_id: "t1" }] },
          },
        },
        favorites: {
          byMethod: {
            select: { data: [{ tender_id: "t2" }] },
          },
        },
      },
    });

    const hidden = await hasOwnVisibleRecommendations(client as never, {
      userId: "u1",
    });
    expect(hidden.error).toBeNull();
    expect(hidden.data).toBe(false);

    const withVisible = createFakeSupabaseClient({
      tables: {
        tender_recommendations: {
          byMethod: {
            select: {
              data: [{ tender_id: "t1" }, { tender_id: "t3" }],
            },
          },
        },
        tender_ratings: {
          byMethod: {
            select: { data: [{ tender_id: "t1" }] },
          },
        },
        favorites: {
          byMethod: {
            select: { data: [] },
          },
        },
      },
    });
    const visible = await hasOwnVisibleRecommendations(withVisible as never, {
      userId: "u1",
    });
    expect(visible.error).toBeNull();
    expect(visible.data).toBe(true);
  });
});
