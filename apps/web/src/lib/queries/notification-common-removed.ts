/**
 * Avisos in-app cuando otro quita tu licitación de Común.
 * Fuente: notification_common_removed (sobrevive al DELETE de shared_favorites).
 */
import type { Database } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isNotificationInTrashWindow } from "./notifications";

export type CommonRemovedInboxNotification = {
  tenderId: string;
  title: string;
  removedByDisplayName: string | null;
  removedAt: string;
  unread: boolean;
  trashedAt: string | null;
};

type ListRow = {
  tender_id: string;
  removed_by_display_name: string | null;
  created_at: string;
  read_at: string | null;
  trashed_at: string | null;
  tenders: { id: string; title: string } | null;
};

function mapRow(row: ListRow): CommonRemovedInboxNotification {
  const title = row.tenders?.title?.trim() || "Licitación";
  const trashedAt = row.trashed_at;
  return {
    tenderId: row.tender_id,
    title,
    removedByDisplayName: row.removed_by_display_name,
    removedAt: row.created_at,
    unread: trashedAt == null && row.read_at == null,
    trashedAt,
  };
}

export async function listOwnCommonRemovedInboxNotifications(
  client: SupabaseClient<Database>,
  input: { userId: string; limit?: number },
): Promise<{ data: CommonRemovedInboxNotification[]; error: Error | null }> {
  const limit = input.limit ?? 50;
  const { data, error } = await client
    .from("notification_common_removed")
    .select(
      `
      tender_id,
      removed_by_display_name,
      created_at,
      read_at,
      trashed_at,
      tenders ( id, title )
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
      .from("notification_common_removed")
      .delete()
      .eq("user_id", input.userId)
      .in("tender_id", expiredTenderIds);
    if (delErr) return { data: [], error: new Error(delErr.message) };
  }

  const mapped = rows
    .filter((r) => !expiredTenderIds.includes(r.tender_id))
    .map(mapRow)
    .sort((a, b) => (a.removedAt < b.removedAt ? 1 : -1));

  return { data: mapped.slice(0, limit), error: null };
}

export async function markOwnCommonRemovedNotificationRead(
  client: SupabaseClient<Database>,
  input: { userId: string; tenderId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("notification_common_removed")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", input.userId)
    .eq("tender_id", input.tenderId)
    .is("read_at", null);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function trashOwnCommonRemovedNotification(
  client: SupabaseClient<Database>,
  input: { userId: string; tenderId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("notification_common_removed")
    .update({ trashed_at: new Date().toISOString() })
    .eq("user_id", input.userId)
    .eq("tender_id", input.tenderId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function restoreOwnCommonRemovedNotificationFromTrash(
  client: SupabaseClient<Database>,
  input: { userId: string; tenderId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("notification_common_removed")
    .update({ trashed_at: null })
    .eq("user_id", input.userId)
    .eq("tender_id", input.tenderId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function permanentlyDeleteOwnCommonRemovedNotification(
  client: SupabaseClient<Database>,
  input: { userId: string; tenderId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("notification_common_removed")
    .delete()
    .eq("user_id", input.userId)
    .eq("tender_id", input.tenderId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}
