/**
 * Avisos in-app: cambios de estado en licitaciones favoritas.
 * Fuente: tender_events ∩ favorites; lectura por aviso en notification_reads;
 * papelera en notification_trash (UI 30 días; luego ocultos en todas partes).
 *
 * Elegibilidad: `tender_events.created_at` > `favorites.created_at`.
 * No leído: no hay fila en `notification_reads` y no está en papelera.
 */
import type { Database } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Días visibles en la pestaña Papelera. */
export const NOTIFICATION_TRASH_RETENTION_DAYS = 30;

export type FavoriteStatusNotification = {
  eventId: string;
  tenderId: string;
  title: string;
  previousStatus: string | null;
  newStatus: string;
  /** Fecha de negocio en origen (para mostrar). */
  occurredAt: string;
  /** Cuándo se insertó el evento en nuestra BD. */
  detectedAt: string;
  sourceCode: string | null;
  unread: boolean;
  /** ISO si está en papelera (cualquier antigüedad). */
  trashedAt: string | null;
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
  created_at: string;
  source_code: string | null;
};

const DEFAULT_LIMIT = 50;

/** ¿Sigue visible en la pestaña Papelera? */
export function isNotificationInTrashWindow(
  trashedAt: string,
  now: Date = new Date(),
): boolean {
  const t = new Date(trashedAt).getTime();
  if (Number.isNaN(t)) return false;
  const ms = NOTIFICATION_TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() - t < ms;
}

/**
 * Días enteros restantes en papelera (1…30).
 * El último día parcial cuenta como 1; caducado → 0.
 */
export function daysUntilNotificationTrashPurge(
  trashedAt: string,
  now: Date = new Date(),
): number {
  const t = new Date(trashedAt).getTime();
  if (Number.isNaN(t)) return 0;
  const ms = NOTIFICATION_TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const remaining = t + ms - now.getTime();
  if (remaining <= 0) return 0;
  return Math.max(1, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
}

/** Copy UI: «Se eliminará definitivamente en X día(s).» */
export function formatNotificationTrashExpiry(trashedAt: string): string {
  const days = daysUntilNotificationTrashPurge(trashedAt);
  if (days <= 0) return "Se eliminará definitivamente muy pronto.";
  if (days === 1) return "Se eliminará definitivamente en 1 día.";
  return `Se eliminará definitivamente en ${days} días.`;
}

/**
 * Lista cambios de estado en favoritos detectados tras marcar como favorito.
 * Incluye avisos en papelera (filtrar por pestaña en UI).
 */
export async function listFavoriteStatusNotifications(
  client: SupabaseClient<Database>,
  input: {
    userId: string;
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
    .select(
      "id, tender_id, event_type, event_status, occurred_at, created_at, source_code",
    )
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
  );

  const eventIds = changes.map((c) => c.eventId);
  const [readIds, trashMap] = await Promise.all([
    listReadEventIds(client, { userId: input.userId, eventIds }),
    listTrashByEventId(client, { userId: input.userId, eventIds }),
  ]);
  if (readIds.error) return { data: [], error: readIds.error };
  if (trashMap.error) return { data: [], error: trashMap.error };

  for (const c of changes) {
    const trashedAt = trashMap.data.get(c.eventId) ?? null;
    c.trashedAt = trashedAt;
    c.unread = trashedAt == null && !readIds.data.has(c.eventId);
  }

  changes.sort((a, b) => (a.detectedAt < b.detectedAt ? 1 : -1));
  return { data: changes.slice(0, limit), error: null };
}

async function listReadEventIds(
  client: SupabaseClient<Database>,
  input: { userId: string; eventIds: string[] },
): Promise<{ data: Set<string>; error: Error | null }> {
  if (input.eventIds.length === 0) return { data: new Set(), error: null };

  const { data, error } = await client
    .from("notification_reads")
    .select("event_id")
    .eq("user_id", input.userId)
    .in("event_id", input.eventIds);

  if (error) return { data: new Set(), error: new Error(error.message) };
  return {
    data: new Set((data ?? []).map((r) => r.event_id)),
    error: null,
  };
}

async function listTrashByEventId(
  client: SupabaseClient<Database>,
  input: { userId: string; eventIds: string[] },
): Promise<{ data: Map<string, string>; error: Error | null }> {
  if (input.eventIds.length === 0) {
    return { data: new Map(), error: null };
  }

  const { data, error } = await client
    .from("notification_trash")
    .select("event_id, trashed_at")
    .eq("user_id", input.userId)
    .in("event_id", input.eventIds);

  if (error) return { data: new Map(), error: new Error(error.message) };
  return {
    data: new Map((data ?? []).map((r) => [r.event_id, r.trashed_at])),
    error: null,
  };
}

/**
 * ¿Hay algún aviso de favoritos aún sin leer (fuera de papelera)?
 * Un solo RPC EXISTS — pensado para el badge del layout (no montar la lista).
 */
export async function hasUnreadFavoriteStatusNotifications(
  client: SupabaseClient<Database>,
  input: { userId: string },
): Promise<{ data: boolean; error: Error | null }> {
  const { data, error } = await client.rpc(
    "has_unread_favorite_status_notifications",
    { p_user_id: input.userId },
  );
  if (error) return { data: false, error: new Error(error.message) };
  return { data: Boolean(data), error: null };
}

/**
 * Badge del nav: favoritos-estado O digest email sin leer.
 * Prefiere RPC unificado; si no existe aún (migración pendiente), cae al de favoritos.
 */
export async function hasUnreadNotifications(
  client: SupabaseClient<Database>,
  input: { userId: string },
): Promise<{ data: boolean; error: Error | null }> {
  const { data, error } = await client.rpc("has_unread_notifications", {
    p_user_id: input.userId,
  });
  if (!error) return { data: Boolean(data), error: null };
  return hasUnreadFavoriteStatusNotifications(client, input);
}

/** Conteo de no leídas (métrica del home; sin montar el buzón). */
export async function countUnreadFavoriteStatusNotifications(
  client: SupabaseClient<Database>,
  input: { userId: string },
): Promise<{ data: number; error: Error | null }> {
  const { data, error } = await client.rpc(
    "count_unread_favorite_status_notifications",
    { p_user_id: input.userId },
  );
  if (error) return { data: 0, error: new Error(error.message) };
  return { data: Number(data ?? 0), error: null };
}

/** Home: favoritos + digests no leídos. */
export async function countUnreadNotifications(
  client: SupabaseClient<Database>,
  input: { userId: string },
): Promise<{ data: number; error: Error | null }> {
  const { data, error } = await client.rpc("count_unread_notifications", {
    p_user_id: input.userId,
  });
  if (!error) return { data: Number(data ?? 0), error: null };
  return countUnreadFavoriteStatusNotifications(client, input);
}

/**
 * Últimos avisos fuera de papelera (home preview).
 * No sustituye `listFavoriteStatusNotifications` del buzón.
 */
export async function listRecentFavoriteStatusNotifications(
  client: SupabaseClient<Database>,
  input: { userId: string; limit?: number },
): Promise<{ data: FavoriteStatusNotification[]; error: Error | null }> {
  const limit = input.limit ?? 3;
  const { data, error } = await client.rpc(
    "list_recent_favorite_status_notifications",
    { p_user_id: input.userId, p_limit: limit },
  );
  if (error) return { data: [], error: new Error(error.message) };

  const rows: FavoriteStatusNotification[] = (data ?? []).map((r) => ({
    eventId: r.event_id,
    tenderId: r.tender_id,
    title: r.title?.trim() || "Licitación",
    previousStatus: r.previous_status,
    newStatus: r.new_status,
    occurredAt: r.occurred_at,
    detectedAt: r.detected_at,
    sourceCode: r.source_code,
    unread: Boolean(r.unread),
    trashedAt: null,
  }));
  return { data: rows, error: null };
}

/** Marca un aviso concreto como leído (al abrir la ficha desde el buzón). */
export async function markOwnNotificationRead(
  client: SupabaseClient<Database>,
  input: { userId: string; eventId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client.from("notification_reads").upsert(
    {
      user_id: input.userId,
      event_id: input.eventId,
      read_at: new Date().toISOString(),
    },
    { onConflict: "user_id,event_id" },
  );

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/** Mueve un aviso a la papelera. */
export async function trashOwnNotification(
  client: SupabaseClient<Database>,
  input: { userId: string; eventId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client.from("notification_trash").upsert(
    {
      user_id: input.userId,
      event_id: input.eventId,
      trashed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,event_id" },
  );

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/** Saca un aviso de la papelera (p. ej. deshacer). */
export async function restoreOwnNotificationFromTrash(
  client: SupabaseClient<Database>,
  input: { userId: string; eventId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("notification_trash")
    .delete()
    .eq("user_id", input.userId)
    .eq("event_id", input.eventId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/**
 * Filtra transiciones reales de estado detectadas tras el favorito.
 * `unread` / `trashedAt` se rellenan después.
 */
export function statusChangeNotifications(
  events: EventRow[],
  favCreated: Map<string, string>,
  titles: Map<string, string>,
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

    const ordered = [...list].sort((a, b) => {
      if (a.occurred_at !== b.occurred_at) {
        return a.occurred_at < b.occurred_at ? -1 : 1;
      }
      return a.created_at < b.created_at ? -1 : 1;
    });

    let prevStatus: string | null = null;
    for (const e of ordered) {
      if (!e.event_status) continue;
      if (e.created_at < since) {
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
          detectedAt: e.created_at,
          sourceCode: e.source_code,
          unread: true,
          trashedAt: null,
        });
      }
      prevStatus = e.event_status;
    }
  }
  return out;
}
