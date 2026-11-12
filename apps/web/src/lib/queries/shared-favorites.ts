/**
 * Favoritos Común (ADR 029). RLS is_app_user(); nunca service_role.
 */
import type { Database } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const SHARED_FAVORITE_NOTES_MAX = 500;

type SharedFavoriteRow = Database["public"]["Tables"]["shared_favorites"]["Row"];

export type SharedFavoriteWithTender = SharedFavoriteRow & {
  added_by_display_name: string | null;
  tenders: {
    id: string;
    title: string;
    status: string | null;
    estimated_value: number | null;
    currency: string;
    cpv_codes: string[];
    publication_date: string | null;
    deadline_at: string | null;
  } | null;
};

/** IDs ya en Común entre un conjunto (p. ej. mis favoritos). */
export async function listSharedFavoriteTenderIds(
  client: SupabaseClient<Database>,
  tenderIds: string[],
): Promise<{ data: Set<string>; error: Error | null }> {
  if (tenderIds.length === 0) return { data: new Set(), error: null };

  const { data, error } = await client
    .from("shared_favorites")
    .select("tender_id")
    .in("tender_id", tenderIds);

  if (error) return { data: new Set(), error: new Error(error.message) };
  return {
    data: new Set((data ?? []).map((r) => r.tender_id)),
    error: null,
  };
}

/** Quién compartió primero (si existe). */
export async function getSharedFavoriteOwner(
  client: SupabaseClient<Database>,
  tenderId: string,
): Promise<{
  data: { addedBy: string; displayName: string | null } | null;
  error: Error | null;
}> {
  const { data, error } = await client
    .from("shared_favorites")
    .select("added_by, users:added_by ( display_name )")
    .eq("tender_id", tenderId)
    .maybeSingle();

  if (error) return { data: null, error: new Error(error.message) };
  if (!data) return { data: null, error: null };

  const users = data.users as { display_name: string | null } | null;
  return {
    data: {
      addedBy: data.added_by,
      displayName: users?.display_name ?? null,
    },
    error: null,
  };
}

export async function listSharedFavorites(
  client: SupabaseClient<Database>,
): Promise<{ data: SharedFavoriteWithTender[]; error: Error | null }> {
  const { data, error } = await client
    .from("shared_favorites")
    .select(
      `
      tender_id,
      added_by,
      notes,
      created_at,
      users:added_by ( display_name ),
      tenders (
        id,
        title,
        status,
        estimated_value,
        currency,
        publication_date,
        deadline_at,
        tender_cpvs ( cpv_code )
      )
    `,
    )
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: new Error(error.message) };

  const rows: SharedFavoriteWithTender[] = (data ?? []).map((row) => {
    const users = row.users as { display_name: string | null } | null;
    const tender = row.tenders as
      | {
          id: string;
          title: string;
          status: string | null;
          estimated_value: number | null;
          currency: string;
          publication_date: string | null;
          deadline_at: string | null;
          tender_cpvs?: { cpv_code: string }[] | null;
        }
      | null;

    if (!tender) {
      return {
        tender_id: row.tender_id,
        added_by: row.added_by,
        notes: row.notes,
        created_at: row.created_at,
        added_by_display_name: users?.display_name ?? null,
        tenders: null,
      };
    }

    const { tender_cpvs, ...rest } = tender;
    return {
      tender_id: row.tender_id,
      added_by: row.added_by,
      notes: row.notes,
      created_at: row.created_at,
      added_by_display_name: users?.display_name ?? null,
      tenders: {
        ...rest,
        cpv_codes: [...(tender_cpvs ?? []).map((r) => r.cpv_code)].sort(),
      },
    };
  });

  return { data: rows, error: null };
}

export async function addSharedFavorite(
  client: SupabaseClient<Database>,
  input: { userId: string; tenderId: string; notes?: string | null },
): Promise<
  | { ok: true; alreadyExists: false }
  | {
      ok: false;
      alreadyExists: true;
      ownerDisplayName: string | null;
    }
  | { ok: false; alreadyExists: false; error: Error }
> {
  const notes =
    input.notes == null || input.notes.trim() === ""
      ? null
      : input.notes.trim().slice(0, SHARED_FAVORITE_NOTES_MAX);

  const existing = await getSharedFavoriteOwner(client, input.tenderId);
  if (existing.error) {
    return { ok: false, alreadyExists: false, error: existing.error };
  }
  if (existing.data) {
    return {
      ok: false,
      alreadyExists: true,
      ownerDisplayName: existing.data.displayName,
    };
  }

  const { error } = await client.from("shared_favorites").insert({
    tender_id: input.tenderId,
    added_by: input.userId,
    notes,
  });

  if (error) {
    if (error.code === "23505") {
      const again = await getSharedFavoriteOwner(client, input.tenderId);
      return {
        ok: false,
        alreadyExists: true,
        ownerDisplayName: again.data?.displayName ?? null,
      };
    }
    return { ok: false, alreadyExists: false, error: new Error(error.message) };
  }

  return { ok: true, alreadyExists: false };
}

export async function removeSharedFavorite(
  client: SupabaseClient<Database>,
  tenderId: string,
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("shared_favorites")
    .delete()
    .eq("tender_id", tenderId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}
