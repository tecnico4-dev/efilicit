import { describe, expect, it } from "vitest";
import { createFakeSupabaseClient } from "@/test/fake-supabase";
import {
  dedupeAlertRelatedByTender,
  isAlertRelatedActive,
  isAlertRelatedInTrashWindow,
  listOwnAlertRelatedQueueItems,
  listOwnQueueIdsForAlert,
  queueIdsForTender,
  reassignOwnAlertQueueItems,
  resolveQueueTenderId,
  type AlertRelatedQueueItem,
} from "./alert-related-tenders";

function item(
  overrides: Partial<AlertRelatedQueueItem> & {
    queueId: string;
    tenderId: string;
  },
): AlertRelatedQueueItem {
  return {
    status: "sent",
    createdAt: "2026-11-01T00:00:00Z",
    sentAt: "2026-11-01T01:00:00Z",
    lastError: null,
    alertId: "a1",
    payloadTitle: null,
    digestPeriod: null,
    trashedAt: null,
    tender: null,
    ...overrides,
  };
}

describe("resolveQueueTenderId", () => {
  it("prioriza columna y cae al payload", () => {
    expect(
      resolveQueueTenderId({
        tender_id: "t-col",
        payload: { tender_id: "t-payload" },
      }),
    ).toBe("t-col");
    expect(
      resolveQueueTenderId({
        tender_id: null,
        payload: { tender_id: "t-payload" },
      }),
    ).toBe("t-payload");
    expect(resolveQueueTenderId({ tender_id: "  ", payload: {} })).toBeNull();
  });
});

describe("dedupeAlertRelatedByTender", () => {
  it("conserva la primera aparición por tender", () => {
    const items = [
      item({ queueId: "q1", tenderId: "t1", createdAt: "2026-11-05T00:00:00Z" }),
      item({ queueId: "q2", tenderId: "t2" }),
      item({ queueId: "q3", tenderId: "t1", createdAt: "2026-11-01T00:00:00Z" }),
    ];
    const out = dedupeAlertRelatedByTender(items);
    expect(out.map((i) => i.queueId)).toEqual(["q1", "q2"]);
  });
});

describe("queueIdsForTender / active / trash", () => {
  it("filtra ids y ventanas", () => {
    const items = [
      item({ queueId: "q1", tenderId: "t1" }),
      item({
        queueId: "q2",
        tenderId: "t1",
        trashedAt: "2026-11-10T00:00:00Z",
      }),
      item({ queueId: "q3", tenderId: "t2" }),
    ];
    expect(queueIdsForTender(items, "t1")).toEqual(["q1", "q2"]);
    expect(
      queueIdsForTender(items, "t1", (i) => isAlertRelatedActive(i)),
    ).toEqual(["q1"]);
    expect(isAlertRelatedInTrashWindow(items[1]!)).toBe(true);
  });
});

describe("reassignOwnAlertQueueItems", () => {
  it("actualiza alert_id por chunks", async () => {
    const client = createFakeSupabaseClient({
      tables: {
        notification_queue: {
          byMethod: { update: { data: null } },
        },
      },
    });
    const { error } = await reassignOwnAlertQueueItems(client as never, {
      userId: "u1",
      alertId: "alert-new",
      queueIds: ["q1", "q2", "q1"],
    });
    expect(error).toBeNull();
    const updates = client.callsFor("notification_queue");
    expect(updates).toHaveLength(1);
    expect(updates[0]?.args[0]).toEqual({ alert_id: "alert-new" });
    expect(updates[0]?.filters).toEqual(
      expect.arrayContaining([
        { op: "eq", args: ["user_id", "u1"] },
        { op: "in", args: ["id", ["q1", "q2"]] },
      ]),
    );
  });

  it("sin ids no escribe", async () => {
    const client = createFakeSupabaseClient();
    const { error } = await reassignOwnAlertQueueItems(client as never, {
      userId: "u1",
      alertId: "a",
      queueIds: [],
    });
    expect(error).toBeNull();
    expect(client.calls).toHaveLength(0);
  });
});

describe("listOwnQueueIdsForAlert", () => {
  it("devuelve ids de cola de la alerta", async () => {
    const client = createFakeSupabaseClient({
      tables: {
        notification_queue: {
          byMethod: {
            select: { data: [{ id: "q1" }, { id: "q2" }] },
          },
        },
      },
    });
    const { data, error } = await listOwnQueueIdsForAlert(client as never, {
      userId: "u1",
      alertId: "a1",
    });
    expect(error).toBeNull();
    expect(data).toEqual(["q1", "q2"]);
  });
});

describe("listOwnAlertRelatedQueueItems", () => {
  it("prefiere tender_id de columna frente al payload", async () => {
    const client = createFakeSupabaseClient({
      tables: {
        notification_queue: {
          byMethod: {
            select: {
              data: [
                {
                  id: "q1",
                  status: "sent",
                  created_at: "2026-11-01T00:00:00Z",
                  sent_at: "2026-11-01T01:00:00Z",
                  last_error: null,
                  alert_id: "a1",
                  tender_id: "t-column",
                  payload: { tender_id: "t-payload", title: "X" },
                },
              ],
            },
          },
        },
        alert_related_trash: {
          byMethod: { select: { data: [] } },
        },
        tenders: {
          byMethod: {
            select: {
              data: [
                {
                  id: "t-column",
                  title: "Desde columna",
                  status: "publicada",
                  estimated_value: 10,
                  currency: "EUR",
                  tender_cpvs: [],
                },
              ],
            },
          },
        },
      },
    });
    const { data, error } = await listOwnAlertRelatedQueueItems(
      client as never,
      { userId: "u1", alertId: "a1" },
    );
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0]?.tenderId).toBe("t-column");
    expect(data[0]?.tender?.title).toBe("Desde columna");
  });
});
