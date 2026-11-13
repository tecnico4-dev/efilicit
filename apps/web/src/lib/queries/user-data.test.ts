import { describe, expect, it } from "vitest";
import { createFakeSupabaseClient } from "@/test/fake-supabase";
import {
  createOwnAlert,
  listOwnAlerts,
  updateOwnDigestFrequency,
} from "./user-data";

describe("user-data alerts / digest", () => {
  it("listOwnAlerts", async () => {
    const client = createFakeSupabaseClient({
      tables: {
        alerts: {
          byMethod: {
            select: {
              data: [
                {
                  id: "a1",
                  user_id: "u1",
                  name: "Limpieza",
                  criteria: { version: 1 },
                },
              ],
            },
          },
        },
      },
    });
    const { data, error } = await listOwnAlerts(client as never);
    expect(error).toBeNull();
    expect(data[0]?.name).toBe("Limpieza");
  });

  it("createOwnAlert inserta criteria v1", async () => {
    const client = createFakeSupabaseClient({
      tables: {
        alerts: {
          byMethod: {
            insert: {
              data: {
                id: "a1",
                user_id: "u1",
                name: "Nueva",
                kind: "propia",
                frequency: "diaria",
                is_active: true,
                criteria: { version: 1, keywords: ["agua"] },
              },
            },
          },
        },
      },
    });
    const { data, error } = await createOwnAlert(client as never, {
      userId: "u1",
      name: "Nueva",
      criteria: { version: 1, keywords: ["agua"] },
      kind: "propia",
    });
    expect(error).toBeNull();
    expect(data?.id).toBe("a1");
    const insert = client.callsFor("alerts")[0];
    expect(insert?.args[0]).toMatchObject({
      user_id: "u1",
      name: "Nueva",
      kind: "propia",
      frequency: "diaria",
    });
  });

  it("updateOwnDigestFrequency sincroniza alerts.frequency", async () => {
    const client = createFakeSupabaseClient({
      tables: {
        users: {
          byMethod: {
            update: {
              data: {
                id: "u1",
                digest_frequency: "semanal",
              },
            },
          },
        },
        alerts: {
          byMethod: {
            update: { data: null },
          },
        },
      },
    });
    const { data, error } = await updateOwnDigestFrequency(client as never, {
      userId: "u1",
      digestFrequency: "semanal",
    });
    expect(error).toBeNull();
    expect(data?.digest_frequency).toBe("semanal");
    expect(client.callsFor("alerts")[0]?.args[0]).toMatchObject({
      frequency: "semanal",
    });
  });
});
