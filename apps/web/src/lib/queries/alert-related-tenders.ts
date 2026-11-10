/**
 * Licitaciones asociadas a una alerta vía `notification_queue` (digest email).
 * Papelera del modal (`alert_related_trash`) — no afecta al buzón.
 * Lectura RLS owner-only; nunca service_role.
 */
import type { Database } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isNotificationInTrashWindow,
  NOTIFICATION_TRASH_RETENTION_DAYS,
} from "./notifications";

type Json = Database["public"]["Tables"]["notification_queue"]["Row"]["payload"];

export type AlertQueueStatus = "pending" | "sent" | "failed" | "cancelled";

export type AlertRelatedQueueItem = {
  queueId: string;
  status: AlertQueueStatus;
  createdAt: string;
  sentAt: string | null;
  lastError: string | null;
  tenderId: string;
  /** Título de fallback si la licitación ya no está en BD. */
  payloadTitle: string | null;
  /** Periodo de digest del payload (`YYYY-MM-DD` o `YYYY-Www`). */
  digestPeriod: string | null;
  /** ISO si está en papelera del modal; null si activa. */
  trashedAt: string | null;
  tender: {
    id: string;
    title: string;
    status: string | null;
    estimated_value: number | null;
    currency: string;
    cpv_codes: string[];
  } | null;
};

type QueueRow = {
  id: string;
  status: string;
  created_at: string;
  sent_at: string | null;
  last_error: string | null;
  payload: Json;
};

function asRecord(payload: Json): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

function parseStatus(raw: string): AlertQueueStatus | null {
  if (
    raw === "pending" ||
    raw === "sent" ||
    raw === "failed" ||
    raw === "cancelled"
  ) {
    return raw;
  }
  return null;
}

function tenderIdFromPayload(payload: Json): string | null {
  const tenderId = asRecord(payload).tender_id;
  return typeof tenderId === "string" && tenderId.trim() ? tenderId : null;
}

function titleFromPayload(payload: Json): string | null {
  const title = asRecord(payload).title;
  return typeof title === "string" && title.trim() ? title.trim() : null;
}

function digestFromPayload(payload: Json): string | null {
  const digest = asRecord(payload).digest;
  return typeof digest === "string" && digest.trim() ? digest.trim() : null;
}

/**
 * Alertas del usuario que tienen al menos un ítem en cola
 * (pending / sent / failed / cancelled).
 */
export async function listOwnAlertIdsWithQueueItems(
  client: SupabaseClient<Database>,
  input: { userId: string },
): Promise<{ data: Set<string>; error: Error | null }> {
  const { data, error } = await client
    .from("notification_queue")
    .select("alert_id")
    .eq("user_id", input.userId)
    .not("alert_id", "is", null);

  if (error) return { data: new Set(), error: new Error(error.message) };

  const ids = new Set<string>();
  for (const row of data ?? []) {
    if (row.alert_id) ids.add(row.alert_id);
  }
  return { data: ids, error: null };
}

async function loadTrashMap(
  client: SupabaseClient<Database>,
  input: { userId: string; queueIds: string[] },
): Promise<{ data: Map<string, string>; error: Error | null }> {
  const map = new Map<string, string>();
  if (input.queueIds.length === 0) return { data: map, error: null };

  const CHUNK = 100;
  for (let i = 0; i < input.queueIds.length; i += CHUNK) {
    const chunk = input.queueIds.slice(i, i + CHUNK);
    const { data, error } = await client
      .from("alert_related_trash")
      .select("queue_id, trashed_at")
      .eq("user_id", input.userId)
      .in("queue_id", chunk);
    if (error) return { data: map, error: new Error(error.message) };
    for (const row of data ?? []) {
      map.set(row.queue_id, row.trashed_at);
    }
  }
  return { data: map, error: null };
}

/**
 * Ítems de cola de una alerta (o de todas las del usuario si no hay `alertId`),
 * más recientes primero (`created_at` desc). Une `tenders` + papelera del modal.
 */
export async function listOwnAlertRelatedQueueItems(
  client: SupabaseClient<Database>,
  input: { userId: string; alertId?: string },
): Promise<{ data: AlertRelatedQueueItem[]; error: Error | null }> {
  let query = client
    .from("notification_queue")
    .select("id, status, created_at, sent_at, last_error, payload")
    .eq("user_id", input.userId)
    .order("created_at", { ascending: false });

  if (input.alertId) {
    query = query.eq("alert_id", input.alertId);
  }

  const { data, error } = await query;

  if (error) return { data: [], error: new Error(error.message) };

  const rows = (data as QueueRow[] | null) ?? [];
  const queueIds = rows.map((r) => r.id);
  const trashResult = await loadTrashMap(client, {
    userId: input.userId,
    queueIds,
  });
  if (trashResult.error) {
    return { data: [], error: trashResult.error };
  }

  const tenderIds = [
    ...new Set(
      rows
        .map((r) => tenderIdFromPayload(r.payload))
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  type TenderSummary = NonNullable<AlertRelatedQueueItem["tender"]>;
  const tenderById = new Map<string, TenderSummary>();

  /** PostgREST pone `.in()` en la query string; trozos evitan 400 Bad Request. */
  const TENDER_ID_CHUNK = 100;
  const tenderSelect = `
        id,
        title,
        status,
        estimated_value,
        currency,
        tender_cpvs ( cpv_code )
      `;

  for (let i = 0; i < tenderIds.length; i += TENDER_ID_CHUNK) {
    const chunk = tenderIds.slice(i, i + TENDER_ID_CHUNK);
    const { data: tenders, error: tenderError } = await client
      .from("tenders")
      .select(tenderSelect)
      .in("id", chunk);

    if (tenderError) {
      return { data: [], error: new Error(tenderError.message) };
    }

    for (const t of tenders ?? []) {
      const cpvRows = (
        t as {
          tender_cpvs?: { cpv_code: string }[] | null;
        }
      ).tender_cpvs;
      tenderById.set(t.id, {
        id: t.id,
        title: t.title,
        status: t.status,
        estimated_value: t.estimated_value,
        currency: t.currency,
        cpv_codes: (cpvRows ?? []).map((c) => c.cpv_code).filter(Boolean),
      });
    }
  }

  const out: AlertRelatedQueueItem[] = [];
  for (const row of rows) {
    const status = parseStatus(row.status);
    const tenderId = tenderIdFromPayload(row.payload);
    if (!status || !tenderId) continue;
    out.push({
      queueId: row.id,
      status,
      createdAt: row.created_at,
      sentAt: row.sent_at,
      lastError: row.last_error,
      tenderId,
      payloadTitle: titleFromPayload(row.payload),
      digestPeriod: digestFromPayload(row.payload),
      trashedAt: trashResult.data.get(row.id) ?? null,
      tender: tenderById.get(tenderId) ?? null,
    });
  }

  return { data: out, error: null };
}

/** Mueve una relación alerta↔cola a la papelera del modal. */
export async function trashOwnAlertRelated(
  client: SupabaseClient<Database>,
  input: { userId: string; queueId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client.from("alert_related_trash").upsert(
    {
      user_id: input.userId,
      queue_id: input.queueId,
      trashed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,queue_id" },
  );
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/** Varias a la vez (Vaciar listado). */
export async function trashOwnAlertRelatedMany(
  client: SupabaseClient<Database>,
  input: { userId: string; queueIds: string[] },
): Promise<{ error: Error | null }> {
  const ids = [...new Set(input.queueIds.filter(Boolean))];
  if (ids.length === 0) return { error: null };
  const now = new Date().toISOString();
  const CHUNK = 100;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const rows = chunk.map((queue_id) => ({
      user_id: input.userId,
      queue_id,
      trashed_at: now,
    }));
    const { error } = await client
      .from("alert_related_trash")
      .upsert(rows, { onConflict: "user_id,queue_id" });
    if (error) return { error: new Error(error.message) };
  }
  return { error: null };
}

/** Saca de la papelera del modal (vuelve a Todas). */
export async function restoreOwnAlertRelatedFromTrash(
  client: SupabaseClient<Database>,
  input: { userId: string; queueId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("alert_related_trash")
    .delete()
    .eq("user_id", input.userId)
    .eq("queue_id", input.queueId);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/** Restaura varias de la papelera (Restaurar todo). */
export async function restoreOwnAlertRelatedManyFromTrash(
  client: SupabaseClient<Database>,
  input: { userId: string; queueIds: string[] },
): Promise<{ error: Error | null }> {
  const ids = [...new Set(input.queueIds.filter(Boolean))];
  if (ids.length === 0) return { error: null };
  const CHUNK = 100;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { error } = await client
      .from("alert_related_trash")
      .delete()
      .eq("user_id", input.userId)
      .in("queue_id", chunk);
    if (error) return { error: new Error(error.message) };
  }
  return { error: null };
}

/**
 * Quita de la pestaña Papelera sin devolver a Activas:
 * adelanta trashed_at fuera de la ventana de 30 días (dismiss permanente en UI).
 */
export async function purgeOwnAlertRelatedTrashWindow(
  client: SupabaseClient<Database>,
  input: { userId: string; queueIds: string[] },
): Promise<{ error: Error | null }> {
  const ids = [...new Set(input.queueIds.filter(Boolean))];
  if (ids.length === 0) return { error: null };
  const ms =
    (NOTIFICATION_TRASH_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000;
  const past = new Date(Date.now() - ms).toISOString();
  const CHUNK = 100;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { error } = await client
      .from("alert_related_trash")
      .update({ trashed_at: past })
      .eq("user_id", input.userId)
      .in("queue_id", chunk);
    if (error) return { error: new Error(error.message) };
  }
  return { error: null };
}

export function isAlertRelatedActive(item: AlertRelatedQueueItem): boolean {
  return item.trashedAt == null;
}

export function isAlertRelatedInTrashWindow(
  item: AlertRelatedQueueItem,
  now: Date = new Date(),
): boolean {
  if (item.trashedAt == null) return false;
  return isNotificationInTrashWindow(item.trashedAt, now);
}
