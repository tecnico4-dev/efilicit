import { describe, expect, it } from "vitest";
import { createFakeSupabaseClient } from "@/test/fake-supabase";
import {
  getEficenMemberDisplayNameByUserId,
  listEficenMembersForShare,
} from "./eficen-members";

describe("listEficenMembersForShare", () => {
  it("devuelve activos con cuenta y excluye al usuario actual", async () => {
    const client = createFakeSupabaseClient({
      tables: {
        eficen_members: {
          byMethod: {
            select: {
              data: [
                {
                  id: "m1",
                  display_name: "Ana",
                  role_title: "Ingeniera",
                  user_id: "u-ana",
                },
                {
                  id: "m2",
                  display_name: "Yo",
                  role_title: null,
                  user_id: "u-me",
                },
                {
                  id: "m3",
                  display_name: "Sin cuenta",
                  role_title: null,
                  user_id: null,
                },
                {
                  id: "m4",
                  display_name: "Luis",
                  role_title: "PM",
                  user_id: "u-luis",
                },
              ],
            },
          },
        },
      },
    });

    const result = await listEficenMembersForShare(client as never, "u-me");
    expect(result.error).toBeNull();
    expect(result.data).toEqual([
      {
        id: "m1",
        displayName: "Ana",
        roleTitle: "Ingeniera",
        userId: "u-ana",
      },
      {
        id: "m4",
        displayName: "Luis",
        roleTitle: "PM",
        userId: "u-luis",
      },
    ]);
  });

  it("propaga error de supabase", async () => {
    const client = createFakeSupabaseClient({
      tables: {
        eficen_members: {
          byMethod: {
            select: { data: null, error: { message: "boom" } },
          },
        },
      },
    });
    const result = await listEficenMembersForShare(client as never, "u1");
    expect(result.data).toEqual([]);
    expect(result.error?.message).toBe("boom");
  });
});

describe("getEficenMemberDisplayNameByUserId", () => {
  it("devuelve display_name o null", async () => {
    const client = createFakeSupabaseClient({
      tables: {
        eficen_members: {
          byMethod: {
            select: {
              data: { display_name: "Ana" },
            },
          },
        },
      },
    });
    const hit = await getEficenMemberDisplayNameByUserId(client as never, "u-ana");
    expect(hit.data).toBe("Ana");

    const emptyClient = createFakeSupabaseClient({
      tables: {
        eficen_members: {
          byMethod: {
            select: { data: null },
          },
        },
      },
    });
    const miss = await getEficenMemberDisplayNameByUserId(
      emptyClient as never,
      "u-x",
    );
    expect(miss.data).toBeNull();
  });
});
