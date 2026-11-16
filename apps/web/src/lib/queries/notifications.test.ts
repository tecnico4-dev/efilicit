import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabaseClient } from "@/test/fake-supabase";
import {
  daysUntilNotificationTrashPurge,
  formatNotificationTrashExpiry,
  isNotificationInTrashWindow,
  listFavoriteStatusNotifications,
  markOwnNotificationRead,
  markOwnNotificationUnread,
  mergeStatusWatchmarks,
  resolveStatusWatchFolder,
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

describe("mergeStatusWatchmarks", () => {
  it("une propios y Común con LEAST y sin duplicar tender_id", () => {
    const map = mergeStatusWatchmarks(
      [
        { tender_id: "t1", created_at: "2026-11-05T00:00:00Z" },
        { tender_id: "t2", created_at: "2026-11-01T00:00:00Z" },
      ],
      [
        { tender_id: "t1", created_at: "2026-11-01T00:00:00Z" },
        { tender_id: "t3", created_at: "2026-11-03T00:00:00Z" },
      ],
    );
    expect([...map.entries()].sort()).toEqual([
      ["t1", "2026-11-01T00:00:00Z"],
      ["t2", "2026-11-01T00:00:00Z"],
      ["t3", "2026-11-03T00:00:00Z"],
    ]);
  });
});

describe("resolveStatusWatchFolder", () => {
  it("clasifica propia, comun, ambas o null", () => {
    const personal = new Set(["t1", "t2"]);
    const shared = new Set(["t2", "t3"]);
    expect(resolveStatusWatchFolder("t1", personal, shared)).toBe("propia");
    expect(resolveStatusWatchFolder("t3", personal, shared)).toBe("comun");
    expect(resolveStatusWatchFolder("t2", personal, shared)).toBe("ambas");
    expect(resolveStatusWatchFolder("t9", personal, shared)).toBeNull();
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

const statusChangeEvents = [
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
];

function fakeStatusListClient(input: {
  favorites?: unknown[];
  shared?: unknown[];
  events?: unknown[];
  notificationSelects?: Array<{ data: unknown }>;
}) {
  return createFakeSupabaseClient({
    tables: {
      favorites: {
        byMethod: {
          select: { data: input.favorites ?? [] },
        },
      },
      shared_favorites: {
        byMethod: {
          select: { data: input.shared ?? [] },
        },
      },
      tender_events: {
        byMethod: {
          select: { data: input.events ?? statusChangeEvents },
        },
      },
      notification_favorites: {
        byMethod: {
          select: input.notificationSelects ?? [
            { data: [{ event_id: "e2" }] },
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
}

describe("listFavoriteStatusNotifications (fake supabase)", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-11-12T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lista cambios de favorito propio", async () => {
    const client = fakeStatusListClient({
      favorites: [
        {
          tender_id: "t1",
          created_at: "2026-11-01T00:00:00Z",
          tenders: { id: "t1", title: "Obra X" },
        },
      ],
    });

    const { data, error } = await listFavoriteStatusNotifications(
      client as never,
      { userId: "u1" },
    );
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0]?.newStatus).toBe("adjudicada");
    expect(data[0]?.unread).toBe(true);
    expect(data[0]?.watchFolder).toBe("propia");
  });

  it("lista cambios solo presentes en Común", async () => {
    const client = fakeStatusListClient({
      shared: [
        {
          tender_id: "t1",
          created_at: "2026-11-01T00:00:00Z",
          tenders: { id: "t1", title: "Obra común" },
        },
      ],
    });

    const { data, error } = await listFavoriteStatusNotifications(
      client as never,
      { userId: "u1" },
    );
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0]?.eventId).toBe("e2");
    expect(data[0]?.title).toBe("Obra común");
    expect(data[0]?.watchFolder).toBe("comun");
  });

  it("propio + Común misma licitación → un solo aviso", async () => {
    const client = fakeStatusListClient({
      favorites: [
        {
          tender_id: "t1",
          created_at: "2026-11-04T00:00:00Z",
          tenders: { id: "t1", title: "Obra propia" },
        },
      ],
      shared: [
        {
          tender_id: "t1",
          created_at: "2026-11-01T00:00:00Z",
          tenders: { id: "t1", title: "Obra común" },
        },
      ],
    });

    const { data, error } = await listFavoriteStatusNotifications(
      client as never,
      { userId: "u1" },
    );
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0]?.eventId).toBe("e2");
    // Título preferido del favorito personal cuando hay ambos.
    expect(data[0]?.title).toBe("Obra propia");
    expect(data[0]?.watchFolder).toBe("ambas");
    expect(client.callsFor("tender_events")).toHaveLength(1);
  });

  it("sin propios ni Común → lista vacía", async () => {
    const client = fakeStatusListClient({});
    const { data, error } = await listFavoriteStatusNotifications(
      client as never,
      { userId: "u1" },
    );
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect(client.callsFor("tender_events")).toHaveLength(0);
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
