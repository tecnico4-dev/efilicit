/**
 * Avisos in-app: cambios de estado en licitaciones seguidas.
 * Fuente: tender_events ∩ (favorites propias ∪ shared_favorites);
 * estado UI en notification_favorites (read_at / trashed_at / deleted).
 *
 * Elegibilidad: `tender_events.created_at` > watermark
 * (`favorites.created_at` y/o `shared_favorites.created_at`; si ambas, LEAST).
 * Una fila UI por (user_id, event_id): propio+Común no duplica.
 * Papelera UI 30 días; luego `deleted=true` (lazy al listar).
 */
import type { Database } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Días visibles en la pestaña Papelera. */
export const NOTIFICATION_TRASH_RETENTION_DAYS = 30;

/** Origen del seguimiento para copy del buzón (`ambas` → no mostrar «Carpeta»). */
export type StatusWatchFolder = "propia" | "comun" | "ambas";

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
  /** ISO si está en papelera (ventana 30 días). */
  trashedAt: string | null;
  /** Favorito personal, Común, o ambos (DTO; no columna BD). */
  watchFolder: StatusWatchFolder;
};

type WatchedTenderRow = {
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

type FavoriteStateRow = {
  event_id: string;
  read_at: string | null;
  trashed_at: string | null;
  deleted: boolean;
};

const DEFAULT_LIMIT = 50;
const ID_CHUNK = 100;

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
 * Watermark por licitación: propias del usuario ∪ Común del equipo.
 * Si está en ambos, `LEAST(created_at)` (una sola entrada; sin duplicar avisos).
 */
export function mergeStatusWatchmarks(
  personal: ReadonlyArray<{ tender_id: string; created_at: string }>,
  shared: ReadonlyArray<{ tender_id: string; created_at: string }>,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const row of personal) {
    const prev = out.get(row.tender_id);
    if (!prev || row.created_at < prev) out.set(row.tender_id, row.created_at);
  }
  for (const row of shared) {
    const prev = out.get(row.tender_id);
    if (!prev || row.created_at < prev) out.set(row.tender_id, row.created_at);
  }
  return out;
}

/** Carpeta de seguimiento para UI; `null` si no está en ninguna. */
export function resolveStatusWatchFolder(
  tenderId: string,
  personalIds: ReadonlySet<string>,
  sharedIds: ReadonlySet<string>,
): StatusWatchFolder | null {
  const inPersonal = personalIds.has(tenderId);
  const inShared = sharedIds.has(tenderId);
  if (inPersonal && inShared) return "ambas";
  if (inPersonal) return "propia";
  if (inShared) return "comun";
  return null;
}

function titlesFromWatched(
  personal: ReadonlyArray<WatchedTenderRow>,
  shared: ReadonlyArray<WatchedTenderRow>,
): Map<string, string> {
  const titles = new Map<string, string>();
  for (const row of [...shared, ...personal]) {
    const title = row.tenders?.title?.trim() || "Licitación";
    // Personal pisa Común si ambos aportan título.
    titles.set(row.tender_id, title);
  }
  return titles;
}

/**
 * Lista cambios de estado tras empezar a seguir la licitación
 * (favorito propio y/o carpeta Común). Una entrada por event_id.
 * Incluye avisos en papelera (filtrar por pestaña en UI). Omite `deleted`.
 */
export async function listFavoriteStatusNotifications(
  client: SupabaseClient<Database>,
  input: {
    userId: string;
    limit?: number;
  },
): Promise<{ data: FavoriteStatusNotification[]; error: Error | null }> {
  const limit = input.limit ?? DEFAULT_LIMIT;

  const [favResult, sharedResult] = await Promise.all([
    client
      .from("favorites")
      .select("tender_id, created_at, tenders ( id, title )")
      .eq("user_id", input.userId),
    client
      .from("shared_favorites")
      .select("tender_id, created_at, tenders ( id, title )"),
  ]);

  if (favResult.error) {
    return { data: [], error: new Error(favResult.error.message) };
  }
  if (sharedResult.error) {
    return { data: [], error: new Error(sharedResult.error.message) };
  }

  const favorites = (favResult.data as WatchedTenderRow[] | null) ?? [];
  const shared = (sharedResult.data as WatchedTenderRow[] | null) ?? [];
  const favCreated = mergeStatusWatchmarks(favorites, shared);
  if (favCreated.size === 0) return { data: [], error: null };

  const titles = titlesFromWatched(favorites, shared);
  const personalIds = new Set(favorites.map((f) => f.tender_id));
  const sharedIds = new Set(shared.map((f) => f.tender_id));
  const folders = new Map<string, StatusWatchFolder>();
  for (const tenderId of favCreated.keys()) {
    const folder = resolveStatusWatchFolder(tenderId, personalIds, sharedIds);
    if (folder) folders.set(tenderId, folder);
  }
  const tenderIds = [...favCreated.keys()];

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
    folders,
  );

  const eventIds = changes.map((c) => c.eventId);
  const ensureErr = await ensureFavoriteNotificationRows(client, {
    userId: input.userId,
    eventIds,
  });
  if (ensureErr.error) return { data: [], error: ensureErr.error };

  const expiredErr = await expireFavoriteTrashOutsideWindow(client, {
    userId: input.userId,
  });
  if (expiredErr.error) return { data: [], error: expiredErr.error };

  const stateResult = await listFavoriteStatesByEventId(client, {
    userId: input.userId,
    eventIds,
  });
  if (stateResult.error) return { data: [], error: stateResult.error };

  const out: FavoriteStatusNotification[] = [];
  for (const c of changes) {
    const state = stateResult.data.get(c.eventId);
    if (state?.deleted) continue;
    const trashedAt =
      state?.trashedAt && isNotificationInTrashWindow(state.trashedAt)
        ? state.trashedAt
        : null;
    // Si trashed_at caducó, expireFavoriteTrashOutsideWindow ya marcó deleted.
    if (state?.trashedAt && !trashedAt) continue;
    c.trashedAt = trashedAt;
    c.unread = trashedAt == null && state?.readAt == null;
    out.push(c);
  }

  out.sort((a, b) => (a.detectedAt < b.detectedAt ? 1 : -1));
  return { data: out.slice(0, limit), error: null };
}

/** Inserta filas faltantes (read/trash null, deleted false). */
async function ensureFavoriteNotificationRows(
  client: SupabaseClient<Database>,
  input: { userId: string; eventIds: string[] },
): Promise<{ error: Error | null }> {
  const ids = [...new Set(input.eventIds.filter(Boolean))];
  if (ids.length === 0) return { error: null };

  const existing = new Set<string>();
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const chunk = ids.slice(i, i + ID_CHUNK);
    const { data, error } = await client
      .from("notification_favorites")
      .select("event_id")
      .eq("user_id", input.userId)
      .in("event_id", chunk);
    if (error) return { error: new Error(error.message) };
    for (const row of data ?? []) existing.add(row.event_id);
  }

  const missing = ids.filter((id) => !existing.has(id));
  for (let i = 0; i < missing.length; i += ID_CHUNK) {
    const chunk = missing.slice(i, i + ID_CHUNK);
    const rows = chunk.map((event_id) => ({
      user_id: input.userId,
      event_id,
      read_at: null,
      trashed_at: null,
      deleted: false,
    }));
    const { error } = await client
      .from("notification_favorites")
      .upsert(rows, { onConflict: "user_id,event_id", ignoreDuplicates: true });
    if (error) return { error: new Error(error.message) };
  }
  return { error: null };
}

/** Papelera >30 días → deleted=true, trashed_at=null. */
async function expireFavoriteTrashOutsideWindow(
  client: SupabaseClient<Database>,
  input: { userId: string; now?: Date },
): Promise<{ error: Error | null }> {
  const now = input.now ?? new Date();
  const cutoff = new Date(
    now.getTime() -
      NOTIFICATION_TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { error } = await client
    .from("notification_favorites")
    .update({ deleted: true, trashed_at: null })
    .eq("user_id", input.userId)
    .eq("deleted", false)
    .not("trashed_at", "is", null)
    .lte("trashed_at", cutoff);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

async function listFavoriteStatesByEventId(
  client: SupabaseClient<Database>,
  input: { userId: string; eventIds: string[] },
): Promise<{
  data: Map<
    string,
    { readAt: string | null; trashedAt: string | null; deleted: boolean }
  >;
  error: Error | null;
}> {
  const map = new Map<
    string,
    { readAt: string | null; trashedAt: string | null; deleted: boolean }
  >();
  if (input.eventIds.length === 0) return { data: map, error: null };

  for (let i = 0; i < input.eventIds.length; i += ID_CHUNK) {
    const chunk = input.eventIds.slice(i, i + ID_CHUNK);
    const { data, error } = await client
      .from("notification_favorites")
      .select("event_id, read_at, trashed_at, deleted")
      .eq("user_id", input.userId)
      .in("event_id", chunk);
    if (error) return { data: map, error: new Error(error.message) };
    for (const row of (data as FavoriteStateRow[] | null) ?? []) {
      map.set(row.event_id, {
        readAt: row.read_at,
        trashedAt: row.trashed_at,
        deleted: row.deleted,
      });
    }
  }
  return { data: map, error: null };
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
    // Preview home no muestra «Carpeta»; ambas oculta la línea si se reutiliza.
    watchFolder: "ambas",
  }));
  return { data: rows, error: null };
}

/** Marca un aviso concreto como leído (al abrir la ficha desde el buzón). */
export async function markOwnNotificationRead(
  client: SupabaseClient<Database>,
  input: { userId: string; eventId: string },
): Promise<{ error: Error | null }> {
  const now = new Date().toISOString();
  const { error: upsertError } = await client
    .from("notification_favorites")
    .upsert(
      {
        user_id: input.userId,
        event_id: input.eventId,
        read_at: now,
        trashed_at: null,
        deleted: false,
      },
      { onConflict: "user_id,event_id", ignoreDuplicates: true },
    );
  if (upsertError) return { error: new Error(upsertError.message) };

  const { error } = await client
    .from("notification_favorites")
    .update({ read_at: now })
    .eq("user_id", input.userId)
    .eq("event_id", input.eventId)
    .is("read_at", null);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/** Vuelve a marcar un aviso de favoritos como no leído (p. ej. menú contextual). */
export async function markOwnNotificationUnread(
  client: SupabaseClient<Database>,
  input: { userId: string; eventId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("notification_favorites")
    .update({ read_at: null })
    .eq("user_id", input.userId)
    .eq("event_id", input.eventId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/** Mueve un aviso a la papelera. */
export async function trashOwnNotification(
  client: SupabaseClient<Database>,
  input: { userId: string; eventId: string },
): Promise<{ error: Error | null }> {
  const ensure = await ensureFavoriteNotificationRows(client, {
    userId: input.userId,
    eventIds: [input.eventId],
  });
  if (ensure.error) return ensure;

  const { error } = await client
    .from("notification_favorites")
    .update({
      trashed_at: new Date().toISOString(),
      deleted: false,
    })
    .eq("user_id", input.userId)
    .eq("event_id", input.eventId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/** Saca un aviso de la papelera (vuelve al buzón; trashed_at = null). */
export async function restoreOwnNotificationFromTrash(
  client: SupabaseClient<Database>,
  input: { userId: string; eventId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("notification_favorites")
    .update({ trashed_at: null, deleted: false })
    .eq("user_id", input.userId)
    .eq("event_id", input.eventId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/**
 * Elimina definitivamente un aviso de favoritos (ya no se ve en la web).
 * `deleted=true`, `trashed_at=null`; la fila permanece.
 */
export async function permanentlyDeleteOwnFavoriteNotification(
  client: SupabaseClient<Database>,
  input: { userId: string; eventId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("notification_favorites")
    .update({ deleted: true, trashed_at: null })
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
  folders: Map<string, StatusWatchFolder> = new Map(),
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
          watchFolder: folders.get(tenderId) ?? "propia",
        });
      }
      prevStatus = e.event_status;
    }
  }
  return out;
}
