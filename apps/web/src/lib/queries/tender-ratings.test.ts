import { describe, expect, it } from "vitest";
import { createFakeSupabaseClient } from "@/test/fake-supabase";
import {
  asTenderInterestKind,
  getOwnAlertInterestKindForTender,
  interestKindShortLabel,
  listOwnTenderRatings,
} from "./tender-ratings";

describe("tender interest helpers", () => {
  it("asTenderInterestKind / label", () => {
    expect(asTenderInterestKind("propia")).toBe("propia");
    expect(asTenderInterestKind("x")).toBeNull();
    expect(interestKindShortLabel("propia")).toBe("Eficen");
    expect(interestKindShortLabel("subcontrata")).toBe("Sub");
    expect(interestKindShortLabel(null)).toBeNull();
  });
});

describe("getOwnAlertInterestKindForTender", () => {
  it("toma el kind de la alerta más reciente con match", async () => {
    const client = createFakeSupabaseClient({
      tables: {
        notification_queue: {
          byMethod: {
            select: {
              data: [
                {
                  created_at: "2026-11-05T00:00:00Z",
                  payload: { tender_id: "t1" },
                  alerts: { kind: "subcontrata" },
                },
              ],
            },
          },
        },
      },
    });
    const { data, error } = await getOwnAlertInterestKindForTender(
      client as never,
      { userId: "u1", tenderId: "t1" },
    );
    expect(error).toBeNull();
    expect(data).toBe("subcontrata");
  });
});

describe("listOwnTenderRatings", () => {
  it("mapea score + interest", async () => {
    const client = createFakeSupabaseClient({
      tables: {
        tender_ratings: {
          byMethod: {
            select: {
              data: [
                {
                  tender_id: "t1",
                  score: 4,
                  interest_kind: "propia",
                },
              ],
            },
          },
        },
      },
    });
    const { data, error } = await listOwnTenderRatings(client as never, {
      userId: "u1",
      tenderIds: ["t1"],
    });
    expect(error).toBeNull();
    expect(data.t1).toEqual({ score: 4, interestKind: "propia" });
  });
});
