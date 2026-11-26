import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabaseClient } from "@/test/fake-supabase";
import {
  listOwnDigestInboxNotifications,
  markOwnDigestInboxRead,
  permanentlyDeleteOwnDigestInboxNotification,
  trashOwnDigestInboxNotification,
} from "./digest-inbox";

describe("digest inbox", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-11-12T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("purga filas fuera de ventana 30 días al listar", async () => {
    const client = createFakeSupabaseClient({
      tables: {
        notification_emails: {
          byMethod: {
            select: {
              data: [
                {
                  id: "keep",
                  frequency: "diaria",
                  digest_period: "2026-11-12",
                  sent_at: "2026-11-12T08:00:00Z",
                  tender_count: 2,
                  tender_ids: ["t1", "t2"],
                  read_at: null,
                  trashed_at: null,
                },
                {
                  id: "expired",
                  frequency: "semanal",
                  digest_period: "2026-W40",
                  sent_at: "2026-10-01T08:00:00Z",
                  tender_count: 1,
                  tender_ids: ["t9"],
                  read_at: null,
                  trashed_at: "2026-10-01T09:00:00Z",
                },
              ],
            },
            delete: { data: null },
          },
        },
      },
    });

    const { data, error } = await listOwnDigestInboxNotifications(
      client as never,
      { userId: "u1" },
    );
    expect(error).toBeNull();
    expect(data.map((d) => d.id)).toEqual(["keep"]);
    expect(data[0]?.unread).toBe(true);
    expect(client.callsFor("notification_emails").some((c) => c.method === "delete")).toBe(
      true,
    );
  });

  it("mark / trash / delete definitivo", async () => {
    const client = createFakeSupabaseClient({
      tables: {
        notification_emails: {
          byMethod: {
            update: { data: null },
            delete: { data: null },
          },
        },
      },
    });
    expect(
      (await markOwnDigestInboxRead(client as never, { userId: "u1", digestId: "d1" }))
        .error,
    ).toBeNull();
    expect(
      (
        await trashOwnDigestInboxNotification(client as never, {
          userId: "u1",
          digestId: "d1",
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await permanentlyDeleteOwnDigestInboxNotification(client as never, {
          userId: "u1",
          digestId: "d1",
        })
      ).error,
    ).toBeNull();
    const methods = client.callsFor("notification_emails").map((c) => c.method);
    expect(methods).toEqual(["update", "update", "delete"]);
  });
});
