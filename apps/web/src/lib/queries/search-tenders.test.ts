import { describe, expect, it } from "vitest";
import { createFakeSupabaseClient } from "@/test/fake-supabase";
import { searchTenders } from "./search-tenders";

describe("searchTenders", () => {
  it("aplana criteria a RPC (cpv_match all, open_for_submission)", async () => {
    const client = createFakeSupabaseClient({
      rpc: {
        search_tenders: {
          data: [
            {
              id: "t1",
              title: "X",
              description: null,
              status: "publicada",
              procedure_type: null,
              contract_type: null,
              estimated_value: null,
              currency: "EUR",
              cpv_codes: ["90910000"],
              publication_date: null,
              deadline_at: null,
              contracting_authority_id: null,
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
              rank: 1,
              match_kind: "fts",
              total_count: 1,
            },
          ],
        },
      },
    });

    const { data, error, totalCount } = await searchTenders(client as never, {
      query: "limpieza de colegios",
      criteria: {
        version: 1,
        cpv_codes: ["90910000", "90911000"],
        cpv_match: "all",
        open_for_submission: true,
      },
      limit: 10,
      offset: 0,
    });

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(totalCount).toBe(1);
    expect(client.rpcCalls[0]?.name).toBe("search_tenders");
    expect(client.rpcCalls[0]?.args).toMatchObject({
      p_query: "limpieza colegios",
      p_cpv_match: "all",
      p_open_for_submission: true,
    });
  });

  it("no envía cpv_match si el criterio no pide all", async () => {
    const client = createFakeSupabaseClient({
      rpc: { search_tenders: { data: [] } },
    });
    await searchTenders(client as never, {
      criteria: {
        version: 1,
        cpv_codes: ["90910000", "90911000"],
        cpv_match: "any",
      },
    });
    expect(
      (client.rpcCalls[0]?.args as { p_cpv_match?: string }).p_cpv_match,
    ).toBeUndefined();
  });
});
