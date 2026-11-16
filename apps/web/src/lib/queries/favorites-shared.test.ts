import { describe, expect, it } from "vitest";
import { createFakeSupabaseClient } from "@/test/fake-supabase";
import {
  addFavoriteShares,
  favoriteShareAlreadyMessage,
  listOwnFavoriteShares,
} from "./favorites-shared";

describe("favoriteShareAlreadyMessage", () => {
  it("usa el nombre o fallback", () => {
    expect(favoriteShareAlreadyMessage("Ana")).toBe(
      "Ya has compartido esta licitación con Ana.",
    );
    expect(favoriteShareAlreadyMessage(null)).toBe(
      "Ya has compartido esta licitación con ese usuario.",
    );
  });
});

describe("addFavoriteShares", () => {
  it("exige al menos un destinatario distinto de from", async () => {
    const client = createFakeSupabaseClient();
    const empty = await addFavoriteShares(client as never, {
      fromUserId: "u1",
      tenderId: "t1",
      toUserIds: [],
      kind: "propia",
    });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error.message).toMatch(/persona/i);

    const self = await addFavoriteShares(client as never, {
      fromUserId: "u1",
      tenderId: "t1",
      toUserIds: ["u1"],
      kind: "propia",
    });
    expect(self.ok).toBe(false);
  });

  it("inserta N filas y acumula unique 23505", async () => {
    const client = createFakeSupabaseClient({
      tables: {
        favorites_shared: {
          byMethod: {
            insert: [
              { data: null, error: null },
              { data: null, error: { message: "dup", code: "23505" } },
              { data: null, error: null },
            ],
          },
        },
      },
    });

    const result = await addFavoriteShares(client as never, {
      fromUserId: "u1",
      tenderId: "t1",
      toUserIds: ["u2", "u3", "u4"],
      kind: "subcontrata",
      notes: "  hola  ",
    });

    expect(result).toEqual({
      ok: true,
      inserted: 2,
      already: ["u3"],
    });
    expect(client.callsFor("favorites_shared")).toHaveLength(3);
  });
});

describe("listOwnFavoriteShares", () => {
  it("marca sent/received y resuelve nombres de miembros", async () => {
    const client = createFakeSupabaseClient({
      tables: {
        favorites_shared: {
          byMethod: {
            select: {
              data: [
                {
                  id: "s1",
                  tender_id: "t1",
                  from_user_id: "u-me",
                  to_user_id: "u-ana",
                  kind: "propia",
                  notes: null,
                  created_at: "2026-11-16T10:00:00Z",
                  tenders: {
                    id: "t1",
                    title: "Obra A",
                    status: "open",
                    procedure_type: null,
                    contract_type: null,
                    estimated_value: 1,
                    currency: "EUR",
                    publication_date: null,
                    deadline_at: null,
                    tender_cpvs: [{ cpv_code: "45000000" }],
                  },
                },
                {
                  id: "s2",
                  tender_id: "t2",
                  from_user_id: "u-luis",
                  to_user_id: "u-me",
                  kind: "subcontrata",
                  notes: "mira",
                  created_at: "2026-11-15T10:00:00Z",
                  tenders: {
                    id: "t2",
                    title: "Servicio B",
                    status: null,
                    procedure_type: null,
                    contract_type: null,
                    estimated_value: null,
                    currency: "EUR",
                    publication_date: null,
                    deadline_at: null,
                    tender_cpvs: null,
                  },
                },
              ],
            },
          },
        },
        eficen_members: {
          byMethod: {
            select: {
              data: [
                { user_id: "u-ana", display_name: "Ana" },
                { user_id: "u-luis", display_name: "Luis" },
              ],
            },
          },
        },
      },
    });

    const { data, error } = await listOwnFavoriteShares(client as never, "u-me");
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    expect(data[0]).toMatchObject({
      id: "s1",
      direction: "sent",
      counterpartUserId: "u-ana",
      counterpartDisplayName: "Ana",
      kind: "propia",
    });
    expect(data[0]?.tender?.cpv_codes).toEqual(["45000000"]);
    expect(data[1]).toMatchObject({
      id: "s2",
      direction: "received",
      counterpartUserId: "u-luis",
      counterpartDisplayName: "Luis",
      notes: "mira",
    });
  });
});
