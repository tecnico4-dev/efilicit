/**
 * Avisos in-app al compartir peer (ADR 037).
 * Fuente: notification_shared; emisor/kind/fecha/tender vía join a favorites_shared.
 * Papelera 30 días o eliminar definitivo → DELETE de la fila.
 */
import type { Database } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { asFavoriteKind, type FavoriteKind } from "./favorite-kind";
import { isNotificationInTrashWindow } from "./notifications";

export type SharedInboxNotification = {
  shareId: string;
  tenderId: string;
  title: string;
  fromDisplayName: string | null;
  kind: FavoriteKind;
  /** Cuándo se creó el share (`favorites_shared.created_at`). */
  sharedAt: string;
  unread: boolean;
  trashedAt: string | null;
};

type ListRow = {
  share_id: string;
  read_at: string | null;
  trashed_at: string | null;
  favorites_shared: {
    created_at: string;
    from_user_id: string;
    to_user_id: string;
    kind: string;
    tenders: { id: string; title: string } | null;
  } | null;
};

async function mapMemberNames(
  client: SupabaseClient<Database>,
  userIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;
  const { data } = await client
    .from("eficen_members")
    .select("user_id, display_name")
    .in("user_id", userIds);
  for (const row of data ?? []) {
    if (row.user_id && row.display_name?.trim()) {
      map.set(row.user_id, row.display_name.trim());
    }
  }
  return map;
}

export async function listOwnSharedInboxNotifications(
  client: SupabaseClient<Database>,
  input: { userId: string; limit?: number },
): Promise<{ data: SharedInboxNotification[]; error: Error | null }> {
  const limit = input.limit ?? 50;
  // RLS: solo filas cuyo favorites_shared.to_user_id = perfil del caller.
  const { data, error } = await client
    .from("notification_shared")
    .select(
      `
      share_id,
      read_at,
      trashed_at,
      favorites_shared (
        created_at,
        from_user_id,
        to_user_id,
        kind,
        tenders ( id, title )
      )
    `,
    )
    .limit(limit * 2);

  if (error) return { data: [], error: new Error(error.message) };

  const rows = ((data as ListRow[] | null) ?? []).filter(
    (r) => r.favorites_shared?.to_user_id === input.userId,
  );

  const expiredShareIds = rows
    .filter(
      (r) =>
        r.trashed_at != null && !isNotificationInTrashWindow(r.trashed_at),
    )
    .map((r) => r.share_id);

  if (expiredShareIds.length > 0) {
    const { error: delErr } = await client
      .from("notification_shared")
      .delete()
      .in("share_id", expiredShareIds);
    if (delErr) return { data: [], error: new Error(delErr.message) };
  }

  const alive = rows.filter((r) => !expiredShareIds.includes(r.share_id));
  const fromIds = [
    ...new Set(
      alive
        .map((r) => r.favorites_shared?.from_user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const nameByUser = await mapMemberNames(client, fromIds);

  const mapped: SharedInboxNotification[] = [];
  for (const row of alive) {
    const shared = row.favorites_shared;
    if (!shared) continue;
    const kind = asFavoriteKind(shared.kind) ?? "propia";
    const title = shared.tenders?.title?.trim() || "Licitación";
    const trashedAt = row.trashed_at;
    mapped.push({
      shareId: row.share_id,
      tenderId: shared.tenders?.id ?? "",
      title,
      fromDisplayName: nameByUser.get(shared.from_user_id) ?? null,
      kind,
      sharedAt: shared.created_at,
      unread: trashedAt == null && row.read_at == null,
      trashedAt,
    });
  }

  mapped.sort((a, b) => (a.sharedAt < b.sharedAt ? 1 : -1));
  return {
    data: mapped.filter((n) => n.tenderId).slice(0, limit),
    error: null,
  };
}

export async function markOwnSharedNotificationRead(
  client: SupabaseClient<Database>,
  input: { shareId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("notification_shared")
    .update({ read_at: new Date().toISOString() })
    .eq("share_id", input.shareId)
    .is("read_at", null);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/** Vuelve a marcar un aviso peer como no leído. */
export async function markOwnSharedNotificationUnread(
  client: SupabaseClient<Database>,
  input: { shareId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("notification_shared")
    .update({ read_at: null })
    .eq("share_id", input.shareId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function trashOwnSharedNotification(
  client: SupabaseClient<Database>,
  input: { shareId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("notification_shared")
    .update({ trashed_at: new Date().toISOString() })
    .eq("share_id", input.shareId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function restoreOwnSharedNotificationFromTrash(
  client: SupabaseClient<Database>,
  input: { shareId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("notification_shared")
    .update({ trashed_at: null })
    .eq("share_id", input.shareId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function permanentlyDeleteOwnSharedNotification(
  client: SupabaseClient<Database>,
  input: { shareId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("notification_shared")
    .delete()
    .eq("share_id", input.shareId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}
