import { describe, expect, it } from "vitest";
import { createFakeSupabaseClient } from "@/test/fake-supabase";
import {
  addOwnFavorite,
  isOwnFavorite,
  listOwnFavoriteTenderIds,
  listOwnFavorites,
  removeOwnFavorite,
} from "./favorites";

describe("favorites queries", () => {
  it("isOwnFavorite true/false", async () => {
    const yes = createFakeSupabaseClient({
      tables: {
        favorites: { byMethod: { select: { data: { id: "f1" } } } },
      },
    });
    expect(
      (await isOwnFavorite(yes as never, { userId: "u1", tenderId: "t1" })).data,
    ).toBe(true);

    const no = createFakeSupabaseClient({
      tables: {
        favorites: { byMethod: { select: { data: null } } },
      },
    });
    expect(
      (await isOwnFavorite(no as never, { userId: "u1", tenderId: "t1" })).data,
    ).toBe(false);
  });

  it("listOwnFavoriteTenderIds y listOwnFavorites mapean CPV", async () => {
    const client = createFakeSupabaseClient({
      tables: {
        favorites: {
          byMethod: {
            select: [
              { data: [{ tender_id: "t1" }, { tender_id: "t2" }] },
              {
                data: [
                  {
                    id: "f1",
                    user_id: "u1",
                    tender_id: "t1",
                    kind: "propia",
                    created_at: "2026-01-01T00:00:00Z",
                    tenders: {
                      id: "t1",
                      title: "X",
                      status: "publicada",
                      procedure_type: "abierto",
                      contract_type: "servicios",
                      estimated_value: 10,
                      currency: "EUR",
                      publication_date: null,
                      deadline_at: null,
                      tender_cpvs: [{ cpv_code: "90910000" }, { cpv_code: "72000000" }],
                    },
                  },
                ],
              },
            ],
          },
        },
      },
    });

    const ids = await listOwnFavoriteTenderIds(client as never, ["t1", "t9"]);
    expect([...ids.data].sort()).toEqual(["t1", "t2"]);

    const list = await listOwnFavorites(client as never);
    expect(list.error).toBeNull();
    expect(list.data[0]?.tenders?.cpv_codes).toEqual(["72000000", "90910000"]);
  });

  it("add / remove", async () => {
    const client = createFakeSupabaseClient({
      tables: {
        favorites: {
          byMethod: {
            insert: {
              data: {
                id: "f1",
                user_id: "u1",
                tender_id: "t1",
                kind: "propia",
                created_at: "2026-01-01T00:00:00Z",
              },
            },
            delete: { data: null },
          },
        },
      },
    });
    const added = await addOwnFavorite(client as never, {
      userId: "u1",
      tenderId: "t1",
      kind: "propia",
    });
    expect(added.data?.id).toBe("f1");
    expect(
      (await removeOwnFavorite(client as never, { userId: "u1", tenderId: "t1" }))
        .error,
    ).toBeNull();
  });
});
