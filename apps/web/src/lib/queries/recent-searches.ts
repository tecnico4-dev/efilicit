/**
 * Historial de búsquedas recientes (máx. 5 / usuario).
 * Distinto de saved_searches: automático al Buscar; sin nombre.
 */
import type { Database, SearchCriteria } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { criteriaSignature, parseCriteria } from "@/lib/criteria-display";

type Json = Database["public"]["Tables"]["recent_searches"]["Row"]["criteria"];

function asJson(criteria: SearchCriteria): Json {
  return criteria as unknown as Json;
}

export type RecentSearch = {
  id: string;
  criteria: SearchCriteria;
  searchedAt: string;
};

/** Lista las recientes del usuario (más nuevas primero; ≤5). */
export async function listOwnRecentSearches(
  client: SupabaseClient<Database>,
  input: { userId: string },
): Promise<{ data: RecentSearch[]; error: Error | null }> {
  const { data, error } = await client
    .from("recent_searches")
    .select("id, criteria, searched_at")
    .eq("user_id", input.userId)
    .order("searched_at", { ascending: false })
    .limit(5);

  if (error) return { data: [], error: new Error(error.message) };

  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      criteria: parseCriteria(row.criteria),
      searchedAt: row.searched_at,
    })),
    error: null,
  };
}

/**
 * Registra (o sube) una búsqueda válida. RPC recorta a 5.
 * No usar en paginación (solo 1.ª página de una búsqueda nueva).
 */
export async function recordOwnRecentSearch(
  client: SupabaseClient<Database>,
  input: { criteria: SearchCriteria },
): Promise<{ error: Error | null }> {
  const signature = criteriaSignature(input.criteria);
  const { error } = await client.rpc("record_recent_search", {
    p_criteria: asJson(input.criteria),
    p_signature: signature,
  });
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/** Quita una entrada del historial (RLS own). */
export async function deleteOwnRecentSearch(
  client: SupabaseClient<Database>,
  input: { recentId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("recent_searches")
    .delete()
    .eq("id", input.recentId);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}
