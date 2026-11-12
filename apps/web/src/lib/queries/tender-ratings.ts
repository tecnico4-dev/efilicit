/**
 * Puntuaciones 1–5 de licitaciones por usuario (buzón / interés).
 * Lectura/escritura RLS owner-only.
 */
import type { Database } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TenderScore = 1 | 2 | 3 | 4 | 5;

/** Interés al puntuar; null = sin clasificar. */
export type TenderInterestKind = "propia" | "subcontrata";

export type TenderRating = {
  score: TenderScore;
  interestKind: TenderInterestKind | null;
};

const ID_CHUNK = 100;

function asScore(raw: number): TenderScore | null {
  if (raw === 1 || raw === 2 || raw === 3 || raw === 4 || raw === 5) return raw;
  return null;
}

export function asTenderInterestKind(
  raw: string | null | undefined,
): TenderInterestKind | null {
  if (raw === "propia" || raw === "subcontrata") return raw;
  return null;
}

function asInterestKind(raw: string | null): TenderInterestKind | null {
  return asTenderInterestKind(raw);
}

/**
 * Interés sugerido desde la alerta de cola más reciente que matcheó esta licitación.
 * Usado en ficha (from=alerts|notifications|email) si no viene `interest` en la URL.
 */
export async function getOwnAlertInterestKindForTender(
  client: SupabaseClient<Database>,
  input: { userId: string; tenderId: string },
): Promise<{ data: TenderInterestKind | null; error: Error | null }> {
  const { data, error } = await client
    .from("notification_queue")
    .select("created_at, payload, alerts ( kind )")
    .eq("user_id", input.userId)
    .not("alert_id", "is", null)
    .filter("payload->>tender_id", "eq", input.tenderId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) return { data: null, error: new Error(error.message) };

  for (const row of data ?? []) {
    const alerts = row.alerts as { kind: string | null } | null;
    const kind = asTenderInterestKind(alerts?.kind ?? null);
    if (kind) return { data: kind, error: null };
  }
  return { data: null, error: null };
}

/**
 * Mapa tender_id → kind de alerta (cola más reciente) para un lote (buzón digest).
 */
export async function listOwnAlertInterestKindsForTenders(
  client: SupabaseClient<Database>,
  input: { userId: string; tenderIds: string[] },
): Promise<{
  data: Record<string, TenderInterestKind>;
  error: Error | null;
}> {
  const out: Record<string, TenderInterestKind> = {};
  if (input.tenderIds.length === 0) return { data: out, error: null };

  const wanted = new Set(input.tenderIds);
  // Cola reciente del usuario; filtramos tender_id en cliente (payload JSON).
  const { data, error } = await client
    .from("notification_queue")
    .select("created_at, payload, alerts ( kind )")
    .eq("user_id", input.userId)
    .not("alert_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(Math.min(2000, Math.max(200, input.tenderIds.length * 3)));

  if (error) return { data: {}, error: new Error(error.message) };

  for (const row of data ?? []) {
    const payload = row.payload;
    const tenderId =
      payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      typeof (payload as { tender_id?: unknown }).tender_id === "string"
        ? (payload as { tender_id: string }).tender_id
        : null;
    if (!tenderId || !wanted.has(tenderId) || out[tenderId]) continue;
    const alerts = row.alerts as { kind: string | null } | null;
    const kind = asTenderInterestKind(alerts?.kind ?? null);
    if (kind) out[tenderId] = kind;
  }

  return { data: out, error: null };
}

export function interestKindShortLabel(
  kind: TenderInterestKind | null,
): string | null {
  if (kind === "propia") return "Eficen";
  if (kind === "subcontrata") return "Sub";
  return null;
}

/** Mapa tender_id → rating para un conjunto de ids (troceado). */
export async function listOwnTenderRatings(
  client: SupabaseClient<Database>,
  input: { userId: string; tenderIds: string[] },
): Promise<{ data: Record<string, TenderRating>; error: Error | null }> {
  const out: Record<string, TenderRating> = {};
  if (input.tenderIds.length === 0) return { data: out, error: null };

  for (let i = 0; i < input.tenderIds.length; i += ID_CHUNK) {
    const chunk = input.tenderIds.slice(i, i + ID_CHUNK);
    const { data, error } = await client
      .from("tender_ratings")
      .select("tender_id, score, interest_kind")
      .eq("user_id", input.userId)
      .in("tender_id", chunk);

    if (error) return { data: {}, error: new Error(error.message) };

    for (const row of data ?? []) {
      const score = asScore(row.score);
      if (!score) continue;
      out[row.tender_id] = {
        score,
        interestKind: asInterestKind(row.interest_kind ?? null),
      };
    }
  }

  return { data: out, error: null };
}

/** Upsert nota 1–5 (+ interés; null = sin clasificar). */
export async function upsertOwnTenderRating(
  client: SupabaseClient<Database>,
  input: {
    userId: string;
    tenderId: string;
    score: TenderScore;
    interestKind: TenderInterestKind | null;
  },
): Promise<{ error: Error | null }> {
  const now = new Date().toISOString();
  const { error } = await client.from("tender_ratings").upsert(
    {
      user_id: input.userId,
      tender_id: input.tenderId,
      score: input.score,
      interest_kind: input.interestKind,
      updated_at: now,
    },
    { onConflict: "user_id,tender_id" },
  );
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/** Quitar puntuación (vuelve a sin nota). */
export async function deleteOwnTenderRating(
  client: SupabaseClient<Database>,
  input: { userId: string; tenderId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("tender_ratings")
    .delete()
    .eq("user_id", input.userId)
    .eq("tender_id", input.tenderId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}
