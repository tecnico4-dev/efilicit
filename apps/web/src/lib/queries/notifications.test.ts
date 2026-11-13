import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabaseClient } from "@/test/fake-supabase";
import {
  daysUntilNotificationTrashPurge,
  formatNotificationTrashExpiry,
  isNotificationInTrashWindow,
  listFavoriteStatusNotifications,
  markOwnNotificationRead,
  markOwnNotificationUnread,
  statusChangeNotifications,
  trashOwnNotification,
} from "./notifications";

describe("notification trash window helpers", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-11-12T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ventana 30 días y copy de caducidad", () => {
    expect(
      isNotificationInTrashWindow("2026-10-20T12:00:00.000Z"),
    ).toBe(true);
    expect(
      isNotificationInTrashWindow("2026-10-01T12:00:00.000Z"),
    ).toBe(false);
    expect(daysUntilNotificationTrashPurge("2026-10-20T12:00:00.000Z")).toBe(
      7,
    );
    expect(formatNotificationTrashExpiry("2026-11-11T12:00:00.000Z")).toContain(
      "29 días",
    );
    expect(
      formatNotificationTrashExpiry("2026-10-01T12:00:00.000Z"),
    ).toContain("muy pronto");
  });
});

describe("statusChangeNotifications", () => {
  it("solo emite transiciones reales tras el favorito", () => {
    const favCreated = new Map([["t1", "2026-11-01T00:00:00Z"]]);
    const titles = new Map([["t1", "Obra X"]]);
    const events = [
      {
        id: "e0",
        tender_id: "t1",
        event_type: "ingerida",
        event_status: "publicada",
        occurred_at: "2026-10-01T00:00:00Z",
        created_at: "2026-10-01T00:00:00Z",
        source_code: "placsp",
      },
      {
        id: "e1",
        tender_id: "t1",
        event_type: "actualizada",
        event_status: "publicada",
        occurred_at: "2026-11-02T00:00:00Z",
        created_at: "2026-11-02T00:00:00Z",
        source_code: "placsp",
      },
      {
        id: "e2",
        tender_id: "t1",
        event_type: "actualizada",
        event_status: "adjudicada",
        occurred_at: "2026-11-05T00:00:00Z",
        created_at: "2026-11-05T00:00:00Z",
        source_code: "placsp",
      },
    ];
    const out = statusChangeNotifications(events, favCreated, titles);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      eventId: "e2",
      previousStatus: "publicada",
      newStatus: "adjudicada",
      title: "Obra X",
    });
  });
});

describe("listFavoriteStatusNotifications (fake supabase)", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-11-12T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lista cambios y omite deleted", async () => {
    const client = createFakeSupabaseClient({
      tables: {
        favorites: {
          byMethod: {
            select: {
              data: [
                {
                  tender_id: "t1",
                  created_at: "2026-11-01T00:00:00Z",
                  tenders: { id: "t1", title: "Obra X" },
                },
              ],
            },
          },
        },
        tender_events: {
          byMethod: {
            select: {
              data: [
                {
                  id: "e0",
                  tender_id: "t1",
                  event_type: "ingerida",
                  event_status: "publicada",
                  occurred_at: "2026-10-01T00:00:00Z",
                  created_at: "2026-10-01T00:00:00Z",
                  source_code: "placsp",
                },
                {
                  id: "e2",
                  tender_id: "t1",
                  event_type: "actualizada",
                  event_status: "adjudicada",
                  occurred_at: "2026-11-05T00:00:00Z",
                  created_at: "2026-11-05T00:00:00Z",
                  source_code: "placsp",
                },
              ],
            },
          },
        },
        notification_favorites: {
          byMethod: {
            select: [
              // ensureFavoriteNotificationRows: existing
              { data: [{ event_id: "e2" }] },
              // listFavoriteStatesByEventId
              {
                data: [
                  {
                    event_id: "e2",
                    read_at: null,
                    trashed_at: null,
                    deleted: false,
                  },
                ],
              },
            ],
            update: { data: null },
            upsert: { data: null },
          },
        },
      },
    });

    const { data, error } = await listFavoriteStatusNotifications(
      client as never,
      { userId: "u1" },
    );
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0]?.newStatus).toBe("adjudicada");
    expect(data[0]?.unread).toBe(true);
  });
});

describe("mark / trash notification writes", () => {
  it("markOwnNotificationRead hace upsert+update", async () => {
    const client = createFakeSupabaseClient({
      tables: {
        notification_favorites: {
          byMethod: {
            upsert: { data: null },
            update: { data: null },
          },
        },
      },
    });
    const { error } = await markOwnNotificationRead(client as never, {
      userId: "u1",
      eventId: "e1",
    });
    expect(error).toBeNull();
    expect(client.callsFor("notification_favorites").map((c) => c.method)).toEqual(
      ["upsert", "update"],
    );
  });

  it("markOwnNotificationUnread pone read_at a null", async () => {
    const client = createFakeSupabaseClient({
      tables: {
        notification_favorites: {
          byMethod: {
            update: { data: null },
          },
        },
      },
    });
    const { error } = await markOwnNotificationUnread(client as never, {
      userId: "u1",
      eventId: "e1",
    });
    expect(error).toBeNull();
    const update = client.callsFor("notification_favorites").find(
      (c) => c.method === "update",
    );
    expect(update?.args[0]).toMatchObject({ read_at: null });
  });

  it("trashOwnNotification asegura fila y actualiza trashed_at", async () => {
    const client = createFakeSupabaseClient({
      tables: {
        notification_favorites: {
          byMethod: {
            select: { data: [{ event_id: "e1" }] },
            update: { data: null },
          },
        },
      },
    });
    const { error } = await trashOwnNotification(client as never, {
      userId: "u1",
      eventId: "e1",
    });
    expect(error).toBeNull();
    const update = client.callsFor("notification_favorites").find(
      (c) => c.method === "update",
    );
    expect(update?.args[0]).toMatchObject({ trashed_at: expect.any(String) });
  });
});
