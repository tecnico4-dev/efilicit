import { describe, expect, it } from "vitest";
import { createFakeSupabaseClient } from "@/test/fake-supabase";
import {
  listSharedFavoriteOwners,
  listSharedFavoriteTenderIds,
  sharedFavoriteAlreadyMessage,
} from "./shared-favorites";

describe("sharedFavoriteAlreadyMessage", () => {
  it("distingue dueño propio vs otro", () => {
    expect(
      sharedFavoriteAlreadyMessage("u1", {
        addedBy: "u1",
        displayName: "Ana",
      }),
    ).toBe("Ya has añadido esta licitación.");
    expect(
      sharedFavoriteAlreadyMessage("u1", {
        addedBy: "u2",
        displayName: "Luis",
      }),
    ).toBe("Luis ya ha añadido esta licitación.");
    expect(
      sharedFavoriteAlreadyMessage("u1", {
        addedBy: "u2",
        displayName: null,
      }),
    ).toBe("Otro usuario ya ha añadido esta licitación.");
  });
});

describe("listSharedFavoriteOwners / ids", () => {
  it("mapea owners e ids", async () => {
    const client = createFakeSupabaseClient({
      tables: {
        shared_favorites: {
          byMethod: {
            select: {
              data: [
                {
                  tender_id: "t1",
                  added_by: "u2",
                  added_by_display_name: "Luis",
                },
              ],
            },
          },
        },
      },
    });
    const owners = await listSharedFavoriteOwners(client as never, ["t1", "t2"]);
    expect(owners.data.get("t1")).toEqual({
      addedBy: "u2",
      displayName: "Luis",
    });
    const ids = await listSharedFavoriteTenderIds(client as never, ["t1"]);
    expect([...ids.data]).toEqual(["t1"]);
  });
});
