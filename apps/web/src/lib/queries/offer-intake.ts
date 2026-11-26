/**
 * Intake de pliegos del expediente (ADR 035).
 * La web solo encola (`offer_case_intake` pending) y lee resultados; el worker
 * batch descarga y vuelca. Ficheros en bucket privado `offer-docs` vía signed URL.
 */
import type { Database } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Tables = Database["public"]["Tables"];

export type OfferCaseIntakeRow = Pick<
  Tables["offer_case_intake"]["Row"],
  | "id"
  | "status"
  | "attempts"
  | "last_error"
  | "stats"
  | "requested_at"
  | "started_at"
  | "finished_at"
>;

export type OfferCasePliegoRow = Pick<
  Tables["offer_case_pliegos"]["Row"],
  | "id"
  | "pliego_type"
  | "title"
  | "url"
  | "source_key"
  | "storage_path"
  | "byte_size"
  | "content_type"
  | "fetch_status"
  | "fetch_error"
  | "fetched_at"
  | "created_at"
>;

export type OfferCasePliego = OfferCasePliegoRow & { signed_url: string | null };

export type OfferDeliverableRow = Pick<
  Tables["offer_deliverables"]["Row"],
  | "id"
  | "parent_id"
  | "envelope"
  | "title"
  | "status"
  | "points_max"
  | "our_estimate"
  | "due_at"
  | "sort_order"
  | "source_key"
>;

export type OfferMilestoneRow = Pick<
  Tables["offer_milestones"]["Row"],
  "id" | "kind" | "code" | "title" | "due_at" | "completed_at" | "sort_order"
>;

export const PLIEGO_TYPE_LABELS: Record<string, string> = {
  pcap: "PCAP",
  ppt: "PPT",
  anexo: "Anexo",
  modelo: "Modelo",
  aclaracion: "Aclaración",
  anuncio: "Anuncio",
  rectificacion: "Rectificación",
  otro: "Otro",
};

const SIGNED_URL_SECONDS = 60 * 60;
const OFFER_DOCS_BUCKET = "offer-docs";

export async function requestOfferCaseIntake(
  client: SupabaseClient<Database>,
  input: { offerCaseId: string; requestedBy: string | null },
): Promise<{ error: Error | null }> {
  const { error } = await client.from("offer_case_intake").insert({
    offer_case_id: input.offerCaseId,
    requested_by: input.requestedBy,
  });
  // 23505: ya hay un trabajo abierto para este expediente.
  if (error && error.code !== "23505") return { error: new Error(error.message) };
  return { error: null };
}

export async function getLatestOfferCaseIntake(
  client: SupabaseClient<Database>,
  offerCaseId: string,
): Promise<{ data: OfferCaseIntakeRow | null; error: Error | null }> {
  const { data, error } = await client
    .from("offer_case_intake")
    .select("id, status, attempts, last_error, stats, requested_at, started_at, finished_at")
    .eq("offer_case_id", offerCaseId)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { data: null, error: new Error(error.message) };
  return { data, error: null };
}

export async function listOfferCasePliegos(
  client: SupabaseClient<Database>,
  offerCaseId: string,
): Promise<{ data: OfferCasePliego[]; error: Error | null }> {
  const { data, error } = await client
    .from("offer_case_pliegos")
    .select(
      "id, pliego_type, title, url, source_key, storage_path, byte_size, content_type, fetch_status, fetch_error, fetched_at, created_at",
    )
    .eq("offer_case_id", offerCaseId)
    .order("created_at", { ascending: true });
  if (error) return { data: [], error: new Error(error.message) };

  const rows = data ?? [];
  const keys = rows
    .map((row) => objectKey(row.storage_path))
    .filter((key): key is string => key != null);
  const signed = new Map<string, string>();
  if (keys.length > 0) {
    const { data: urls } = await client.storage
      .from(OFFER_DOCS_BUCKET)
      .createSignedUrls(keys, SIGNED_URL_SECONDS);
    for (const item of urls ?? []) {
      if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
    }
  }

  return {
    data: rows.map((row) => {
      const key = objectKey(row.storage_path);
      return { ...row, signed_url: key ? (signed.get(key) ?? null) : null };
    }),
    error: null,
  };
}

export async function listOfferDeliverables(
  client: SupabaseClient<Database>,
  offerCaseId: string,
): Promise<{ data: OfferDeliverableRow[]; error: Error | null }> {
  const { data, error } = await client
    .from("offer_deliverables")
    .select(
      "id, parent_id, envelope, title, status, points_max, our_estimate, due_at, sort_order, source_key",
    )
    .eq("offer_case_id", offerCaseId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return { data: [], error: new Error(error.message) };
  return { data: data ?? [], error: null };
}

export async function updateOfferDeliverable(
  client: SupabaseClient<Database>,
  input: {
    id: string;
    patch: {
      our_estimate?: string | null;
      status?: string;
    };
  },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("offer_deliverables")
    .update(input.patch)
    .eq("id", input.id);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function listOfferMilestones(
  client: SupabaseClient<Database>,
  offerCaseId: string,
): Promise<{ data: OfferMilestoneRow[]; error: Error | null }> {
  const { data, error } = await client
    .from("offer_milestones")
    .select("id, kind, code, title, due_at, completed_at, sort_order")
    .eq("offer_case_id", offerCaseId)
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("sort_order", { ascending: true });
  if (error) return { data: [], error: new Error(error.message) };
  return { data: data ?? [], error: null };
}

/** `offer-docs/{case}/{sha}.pdf` → `{case}/{sha}.pdf` (clave dentro del bucket). */
function objectKey(storagePath: string | null): string | null {
  if (!storagePath) return null;
  const prefix = `${OFFER_DOCS_BUCKET}/`;
  return storagePath.startsWith(prefix) ? storagePath.slice(prefix.length) : null;
}
