/**
 * Favoritos Común (ADR 029). RLS is_app_user(); nunca service_role.
 */
import type { Database } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  asFavoriteKind,
  favoriteKindLabel,
  favoriteKindLongLabel,
  type FavoriteKind,
} from "./favorite-kind";

export const SHARED_FAVORITE_NOTES_MAX = 500;

/** @deprecated Prefer FavoriteKind */
export type SharedFavoriteKind = FavoriteKind;

export {
  asFavoriteKind as asSharedFavoriteKind,
  favoriteKindLabel as sharedFavoriteKindLabel,
  favoriteKindLongLabel as sharedFavoriteKindLongLabel,
};

type SharedFavoriteRow = Database["public"]["Tables"]["shared_favorites"]["Row"];

export type SharedFavoriteWithTender = SharedFavoriteRow & {
  kind: FavoriteKind;
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

export type SharedFavoriteOwnerInfo = {
  addedBy: string;
  displayName: string | null;
};

/** Quién compartió cada tender ya en Común (p. ej. mis favoritos). */
export async function listSharedFavoriteOwners(
  client: SupabaseClient<Database>,
  tenderIds: string[],
): Promise<{
  data: Map<string, SharedFavoriteOwnerInfo>;
  error: Error | null;
}> {
  if (tenderIds.length === 0) return { data: new Map(), error: null };

  const { data, error } = await client
    .from("shared_favorites")
    .select("tender_id, added_by, added_by_display_name")
    .in("tender_id", tenderIds);

  if (error) return { data: new Map(), error: new Error(error.message) };

  const map = new Map<string, SharedFavoriteOwnerInfo>();
  for (const row of data ?? []) {
    map.set(row.tender_id, {
      addedBy: row.added_by,
      displayName: row.added_by_display_name,
    });
  }
  return { data: map, error: null };
}

/** IDs ya en Común entre un conjunto (p. ej. mis favoritos). */
export async function listSharedFavoriteTenderIds(
  client: SupabaseClient<Database>,
  tenderIds: string[],
): Promise<{ data: Set<string>; error: Error | null }> {
  const owners = await listSharedFavoriteOwners(client, tenderIds);
  if (owners.error) return { data: new Set(), error: owners.error };
  return { data: new Set(owners.data.keys()), error: null };
}

export function sharedFavoriteAlreadyMessage(
  currentUserId: string,
  owner: SharedFavoriteOwnerInfo,
): string {
  if (owner.addedBy === currentUserId) {
    return "Ya has añadido esta licitación.";
  }
  const who = owner.displayName?.trim() || "Otro usuario";
  return `${who} ya ha añadido esta licitación.`;
}

/** Quién compartió primero (si existe). */
export async function getSharedFavoriteOwner(
  client: SupabaseClient<Database>,
  tenderId: string,
): Promise<{
  data: SharedFavoriteOwnerInfo | null;
  error: Error | null;
}> {
  const { data, error } = await client
    .from("shared_favorites")
    .select("added_by, added_by_display_name")
    .eq("tender_id", tenderId)
    .maybeSingle();

  if (error) return { data: null, error: new Error(error.message) };
  if (!data) return { data: null, error: null };

  return {
    data: {
      addedBy: data.added_by,
      displayName: data.added_by_display_name,
    },
    error: null,
  };
}

function mapSharedRow(row: {
  tender_id: string;
  added_by: string;
  added_by_display_name: string | null;
  notes: string | null;
  created_at: string;
  kind: string;
  tenders: unknown;
}): SharedFavoriteWithTender {
  const kind = asFavoriteKind(row.kind) ?? "propia";
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
      added_by_display_name: row.added_by_display_name,
      notes: row.notes,
      created_at: row.created_at,
      kind,
      tenders: null,
    };
  }

  const { tender_cpvs, ...rest } = tender;
  return {
    tender_id: row.tender_id,
    added_by: row.added_by,
    added_by_display_name: row.added_by_display_name,
    notes: row.notes,
    created_at: row.created_at,
    kind,
    tenders: {
      ...rest,
      cpv_codes: [...(tender_cpvs ?? []).map((r) => r.cpv_code)].sort(),
    },
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
      added_by_display_name,
      notes,
      kind,
      created_at,
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

  return {
    data: (data ?? []).map((row) => mapSharedRow(row as Parameters<typeof mapSharedRow>[0])),
    error: null,
  };
}

async function ownDisplayName(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("users")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const name = data.display_name?.trim();
  return name || null;
}

export async function addSharedFavorite(
  client: SupabaseClient<Database>,
  input: {
    userId: string;
    tenderId: string;
    kind: FavoriteKind;
    notes?: string | null;
  },
): Promise<
  | { ok: true; alreadyExists: false }
  | {
      ok: false;
      alreadyExists: true;
      owner: SharedFavoriteOwnerInfo;
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
      owner: existing.data,
    };
  }

  const displayName = await ownDisplayName(client, input.userId);

  const { error } = await client.from("shared_favorites").insert({
    tender_id: input.tenderId,
    added_by: input.userId,
    added_by_display_name: displayName,
    kind: input.kind,
    notes,
  });

  if (error) {
    if (error.code === "23505") {
      const again = await getSharedFavoriteOwner(client, input.tenderId);
      return {
        ok: false,
        alreadyExists: true,
        owner: again.data ?? {
          addedBy: "",
          displayName: null,
        },
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
