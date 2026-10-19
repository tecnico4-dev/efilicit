/**
 * Avisos in-app: cambios de estado en licitaciones favoritas.
 * Fuente: tender_events (lectura pública) ∩ favorites (RLS owner-only).
 */
import type { Database } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type FavoriteStatusNotification = {
  eventId: string;
  tenderId: string;
  title: string;
  previousStatus: string | null;
  newStatus: string;
  occurredAt: string;
  sourceCode: string | null;
  unread: boolean;
};

type FavRow = {
  tender_id: string;
  created_at: string;
  tenders: { id: string; title: string } | null;
};

type EventRow = {
  id: string;
  tender_id: string;
  event_type: string;
  event_status: string | null;
  occurred_at: string;
  source_code: string | null;
};

const DEFAULT_LIMIT = 50;

/**
 * Lista cambios de estado en favoritos (solo tras marcar como favorito).
 * `unread` usa `users.notifications_read_at` (null → todo no leído).
 */
export async function listFavoriteStatusNotifications(
  client: SupabaseClient<Database>,
  input: {
    userId: string;
    notificationsReadAt: string | null;
    limit?: number;
  },
): Promise<{ data: FavoriteStatusNotification[]; error: Error | null }> {
  const limit = input.limit ?? DEFAULT_LIMIT;

  const { data: favs, error: favError } = await client
    .from("favorites")
    .select("tender_id, created_at, tenders ( id, title )")
    .eq("user_id", input.userId);

  if (favError) return { data: [], error: new Error(favError.message) };
  const favorites = (favs as FavRow[] | null) ?? [];
  if (favorites.length === 0) return { data: [], error: null };

  const favCreated = new Map(
    favorites.map((f) => [f.tender_id, f.created_at] as const),
  );
  const titles = new Map(
    favorites.map((f) => [
      f.tender_id,
      f.tenders?.title?.trim() || "Licitación",
    ]),
  );
  const tenderIds = favorites.map((f) => f.tender_id);

  const { data: events, error: evError } = await client
    .from("tender_events")
    .select("id, tender_id, event_type, event_status, occurred_at, source_code")
    .in("tender_id", tenderIds)
    .in("event_type", ["ingerida", "actualizada"])
    .not("event_status", "is", null)
    .order("occurred_at", { ascending: true })
    .limit(500);

  if (evError) return { data: [], error: new Error(evError.message) };

  const changes = statusChangeNotifications(
    (events as EventRow[] | null) ?? [],
    favCreated,
    titles,
    input.notificationsReadAt,
  );

  changes.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
  return { data: changes.slice(0, limit), error: null };
}

/** ¿Hay algún cambio de estado en favoritos más reciente que notifications_read_at? */
export async function hasUnreadFavoriteStatusNotifications(
  client: SupabaseClient<Database>,
  input: { userId: string; notificationsReadAt: string | null },
): Promise<{ data: boolean; error: Error | null }> {
  const { data, error } = await listFavoriteStatusNotifications(client, {
    ...input,
    limit: 1,
  });
  if (error) return { data: false, error };
  return { data: data.some((n) => n.unread), error: null };
}

export async function markOwnNotificationsRead(
  client: SupabaseClient<Database>,
  input: { userId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("users")
    .update({
      notifications_read_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.userId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/** Filtra transiciones reales de estado tras el favorito (baseline previa incluida). */
export function statusChangeNotifications(
  events: EventRow[],
  favCreated: Map<string, string>,
  titles: Map<string, string>,
  notificationsReadAt: string | null,
): FavoriteStatusNotification[] {
  const byTender = new Map<string, EventRow[]>();
  for (const e of events) {
    const list = byTender.get(e.tender_id) ?? [];
    list.push(e);
    byTender.set(e.tender_id, list);
  }

  const out: FavoriteStatusNotification[] = [];
  for (const [tenderId, list] of byTender) {
    const since = favCreated.get(tenderId);
    if (!since) continue;

    let prevStatus: string | null = null;
    for (const e of list) {
      if (!e.event_status) continue;
      if (e.occurred_at < since) {
        prevStatus = e.event_status;
        continue;
      }
      if (
        e.event_type === "actualizada" &&
        prevStatus !== null &&
        e.event_status !== prevStatus
      ) {
        out.push({
          eventId: e.id,
          tenderId,
          title: titles.get(tenderId) ?? "Licitación",
          previousStatus: prevStatus,
          newStatus: e.event_status,
          occurredAt: e.occurred_at,
          sourceCode: e.source_code,
          unread:
            notificationsReadAt == null ||
            e.occurred_at > notificationsReadAt,
        });
      }
      prevStatus = e.event_status;
    }
  }
  return out;
}
