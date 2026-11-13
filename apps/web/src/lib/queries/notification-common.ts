/**
 * Avisos in-app al añadir a Común.
 * Fuente: notification_common; autor/kind/fecha vía join a shared_favorites.
 * Papelera 30 días o eliminar definitivo → DELETE de la fila.
 */
import type { Database } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { asFavoriteKind, type FavoriteKind } from "./favorite-kind";
import { isNotificationInTrashWindow } from "./notifications";

export type CommonInboxNotification = {
  tenderId: string;
  title: string;
  addedByDisplayName: string | null;
  kind: FavoriteKind;
  /** Cuándo se añadió a Común (`shared_favorites.created_at`). */
  sharedAt: string;
  unread: boolean;
  trashedAt: string | null;
};

type ListRow = {
  tender_id: string;
  read_at: string | null;
  trashed_at: string | null;
  shared_favorites: {
    created_at: string;
    added_by_display_name: string | null;
    kind: string;
    tenders: { id: string; title: string } | null;
  } | null;
};

function mapRow(row: ListRow): CommonInboxNotification | null {
  const shared = row.shared_favorites;
  if (!shared) return null;
  const kind = asFavoriteKind(shared.kind) ?? "propia";
  const title = shared.tenders?.title?.trim() || "Licitación";
  const trashedAt = row.trashed_at;
  return {
    tenderId: row.tender_id,
    title,
    addedByDisplayName: shared.added_by_display_name,
    kind,
    sharedAt: shared.created_at,
    unread: trashedAt == null && row.read_at == null,
    trashedAt,
  };
}

export async function listOwnCommonInboxNotifications(
  client: SupabaseClient<Database>,
  input: { userId: string; limit?: number },
): Promise<{ data: CommonInboxNotification[]; error: Error | null }> {
  const limit = input.limit ?? 50;
  const { data, error } = await client
    .from("notification_common")
    .select(
      `
      tender_id,
      read_at,
      trashed_at,
      shared_favorites (
        created_at,
        added_by_display_name,
        kind,
        tenders ( id, title )
      )
    `,
    )
    .eq("user_id", input.userId)
    .limit(limit * 2);

  if (error) return { data: [], error: new Error(error.message) };

  const rows = (data as ListRow[] | null) ?? [];
  const expiredTenderIds = rows
    .filter(
      (r) =>
        r.trashed_at != null && !isNotificationInTrashWindow(r.trashed_at),
    )
    .map((r) => r.tender_id);

  if (expiredTenderIds.length > 0) {
    const { error: delErr } = await client
      .from("notification_common")
      .delete()
      .eq("user_id", input.userId)
      .in("tender_id", expiredTenderIds);
    if (delErr) return { data: [], error: new Error(delErr.message) };
  }

  const mapped = rows
    .filter((r) => !expiredTenderIds.includes(r.tender_id))
    .map(mapRow)
    .filter((n): n is CommonInboxNotification => n != null)
    .sort((a, b) => (a.sharedAt < b.sharedAt ? 1 : -1));

  return { data: mapped.slice(0, limit), error: null };
}

export async function markOwnCommonNotificationRead(
  client: SupabaseClient<Database>,
  input: { userId: string; tenderId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("notification_common")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", input.userId)
    .eq("tender_id", input.tenderId)
    .is("read_at", null);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/** Vuelve a marcar un aviso de Común como no leído. */
export async function markOwnCommonNotificationUnread(
  client: SupabaseClient<Database>,
  input: { userId: string; tenderId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("notification_common")
    .update({ read_at: null })
    .eq("user_id", input.userId)
    .eq("tender_id", input.tenderId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function trashOwnCommonNotification(
  client: SupabaseClient<Database>,
  input: { userId: string; tenderId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("notification_common")
    .update({ trashed_at: new Date().toISOString() })
    .eq("user_id", input.userId)
    .eq("tender_id", input.tenderId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function restoreOwnCommonNotificationFromTrash(
  client: SupabaseClient<Database>,
  input: { userId: string; tenderId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("notification_common")
    .update({ trashed_at: null })
    .eq("user_id", input.userId)
    .eq("tender_id", input.tenderId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function permanentlyDeleteOwnCommonNotification(
  client: SupabaseClient<Database>,
  input: { userId: string; tenderId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("notification_common")
    .delete()
    .eq("user_id", input.userId)
    .eq("tender_id", input.tenderId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}
