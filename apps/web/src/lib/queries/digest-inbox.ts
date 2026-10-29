/**
 * Avisos in-app de digest email (1 aviso = 1 correo enviado).
 * Fuente: digest_inbox_notifications; lectura/papelera en columnas propias.
 */
import type { Database } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isNotificationInTrashWindow,
  NOTIFICATION_TRASH_RETENTION_DAYS,
} from "./notifications";

export type DigestFrequencyLabel = "diaria" | "semanal";

export type DigestInboxNotification = {
  id: string;
  frequency: DigestFrequencyLabel;
  digestPeriod: string;
  sentAt: string;
  tenderCount: number;
  tenderIds: string[];
  unread: boolean;
  trashedAt: string | null;
};

type DigestRow = {
  id: string;
  frequency: string;
  digest_period: string;
  sent_at: string;
  tender_count: number;
  tender_ids: string[] | null;
  read_at: string | null;
  trashed_at: string | null;
};

function asFrequency(raw: string): DigestFrequencyLabel {
  return raw === "semanal" ? "semanal" : "diaria";
}

function mapRow(row: DigestRow): DigestInboxNotification {
  const trashedAt = row.trashed_at;
  return {
    id: row.id,
    frequency: asFrequency(row.frequency),
    digestPeriod: row.digest_period,
    sentAt: row.sent_at,
    tenderCount: row.tender_count,
    tenderIds: row.tender_ids ?? [],
    unread: trashedAt == null && row.read_at == null,
    trashedAt,
  };
}

/** Lista avisos de digest del usuario (incluye papelera). */
export async function listOwnDigestInboxNotifications(
  client: SupabaseClient<Database>,
  input: { userId: string; limit?: number },
): Promise<{ data: DigestInboxNotification[]; error: Error | null }> {
  const limit = input.limit ?? 50;
  const { data, error } = await client
    .from("digest_inbox_notifications")
    .select(
      "id, frequency, digest_period, sent_at, tender_count, tender_ids, read_at, trashed_at",
    )
    .eq("user_id", input.userId)
    .order("sent_at", { ascending: false })
    .limit(limit * 2);

  if (error) return { data: [], error: new Error(error.message) };

  const mapped = ((data as DigestRow[] | null) ?? []).map(mapRow);
  // Conservar activos + papelera en ventana; el resto de papelera caducada no se lista.
  const kept = mapped.filter(
    (n) =>
      n.trashedAt == null || isNotificationInTrashWindow(n.trashedAt),
  );
  return { data: kept.slice(0, limit), error: null };
}

export async function markOwnDigestInboxRead(
  client: SupabaseClient<Database>,
  input: { userId: string; digestId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("digest_inbox_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", input.userId)
    .eq("id", input.digestId)
    .is("read_at", null);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function trashOwnDigestInboxNotification(
  client: SupabaseClient<Database>,
  input: { userId: string; digestId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("digest_inbox_notifications")
    .update({ trashed_at: new Date().toISOString() })
    .eq("user_id", input.userId)
    .eq("id", input.digestId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function restoreOwnDigestInboxFromTrash(
  client: SupabaseClient<Database>,
  input: { userId: string; digestId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("digest_inbox_notifications")
    .update({ trashed_at: null })
    .eq("user_id", input.userId)
    .eq("id", input.digestId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/** Licitaciones de un digest (modal del buzón). */
export type DigestTenderListItem = {
  tenderId: string;
  title: string;
  status: string | null;
  estimated_value: number | null;
  currency: string;
  cpv_codes: string[];
  /** false si el id ya no está en `tenders`. */
  available: boolean;
};

export async function listTendersForDigestInbox(
  client: SupabaseClient<Database>,
  input: { tenderIds: string[] },
): Promise<{ data: DigestTenderListItem[]; error: Error | null }> {
  if (input.tenderIds.length === 0) return { data: [], error: null };

  const { data, error } = await client
    .from("tenders")
    .select(
      "id, title, status, estimated_value, currency, tender_cpvs ( cpv_code )",
    )
    .in("id", input.tenderIds);

  if (error) return { data: [], error: new Error(error.message) };

  type TenderRow = {
    id: string;
    title: string;
    status: string | null;
    estimated_value: number | null;
    currency: string;
    tender_cpvs: { cpv_code: string }[] | null;
  };

  const byId = new Map(
    ((data as TenderRow[] | null) ?? []).map((t) => [
      t.id,
      {
        tenderId: t.id,
        title: t.title?.trim() || "Licitación",
        status: t.status,
        estimated_value: t.estimated_value,
        currency: t.currency || "EUR",
        cpv_codes: (t.tender_cpvs ?? []).map((c) => c.cpv_code),
        available: true,
      } satisfies DigestTenderListItem,
    ]),
  );

  // Conservar orden del correo.
  const ordered: DigestTenderListItem[] = input.tenderIds.map((id) => {
    const hit = byId.get(id);
    if (hit) return hit;
    return {
      tenderId: id,
      title: "Licitación no disponible en el catálogo",
      status: null,
      estimated_value: null,
      currency: "EUR",
      cpv_codes: [],
      available: false,
    };
  });

  return { data: ordered, error: null };
}

export { NOTIFICATION_TRASH_RETENTION_DAYS };
