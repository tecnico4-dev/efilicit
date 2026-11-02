/**
 * Puntuaciones 1–5 de licitaciones por usuario (buzón / interés).
 * Lectura/escritura RLS owner-only.
 */
import type { Database } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TenderScore = 1 | 2 | 3 | 4 | 5;

const ID_CHUNK = 100;

function asScore(raw: number): TenderScore | null {
  if (raw === 1 || raw === 2 || raw === 3 || raw === 4 || raw === 5) return raw;
  return null;
}

/** Mapa tender_id → score para un conjunto de ids (troceado). */
export async function listOwnTenderRatings(
  client: SupabaseClient<Database>,
  input: { userId: string; tenderIds: string[] },
): Promise<{ data: Record<string, TenderScore>; error: Error | null }> {
  const out: Record<string, TenderScore> = {};
  if (input.tenderIds.length === 0) return { data: out, error: null };

  for (let i = 0; i < input.tenderIds.length; i += ID_CHUNK) {
    const chunk = input.tenderIds.slice(i, i + ID_CHUNK);
    const { data, error } = await client
      .from("tender_ratings")
      .select("tender_id, score")
      .eq("user_id", input.userId)
      .in("tender_id", chunk);

    if (error) return { data: {}, error: new Error(error.message) };

    for (const row of data ?? []) {
      const score = asScore(row.score);
      if (score) out[row.tender_id] = score;
    }
  }

  return { data: out, error: null };
}

/** Upsert nota 1–5. */
export async function upsertOwnTenderRating(
  client: SupabaseClient<Database>,
  input: { userId: string; tenderId: string; score: TenderScore },
): Promise<{ error: Error | null }> {
  const now = new Date().toISOString();
  const { error } = await client.from("tender_ratings").upsert(
    {
      user_id: input.userId,
      tender_id: input.tenderId,
      score: input.score,
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
