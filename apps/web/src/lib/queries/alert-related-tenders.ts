/**
 * Licitaciones asociadas a una alerta vía `notification_queue` (digest email).
 * Lectura RLS owner-only; nunca service_role.
 */
import type { Database } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";

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

/**
 * Ítems de cola de una alerta, más recientes primero (`created_at` desc).
 * Une datos canónicos de `tenders` cuando existen.
 */
export async function listOwnAlertRelatedQueueItems(
  client: SupabaseClient<Database>,
  input: { alertId: string },
): Promise<{ data: AlertRelatedQueueItem[]; error: Error | null }> {
  const { data, error } = await client
    .from("notification_queue")
    .select("id, status, created_at, sent_at, last_error, payload")
    .eq("alert_id", input.alertId)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: new Error(error.message) };

  const rows = (data as QueueRow[] | null) ?? [];
  const tenderIds = [
    ...new Set(
      rows
        .map((r) => tenderIdFromPayload(r.payload))
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  type TenderSummary = NonNullable<AlertRelatedQueueItem["tender"]>;
  const tenderById = new Map<string, TenderSummary>();

  if (tenderIds.length > 0) {
    const { data: tenders, error: tenderError } = await client
      .from("tenders")
      .select(
        `
        id,
        title,
        status,
        estimated_value,
        currency,
        tender_cpvs ( cpv_code )
      `,
      )
      .in("id", tenderIds);

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
      tender: tenderById.get(tenderId) ?? null,
    });
  }

  return { data: out, error: null };
}
