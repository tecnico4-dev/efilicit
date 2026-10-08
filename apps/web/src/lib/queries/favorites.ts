/**
 * Favoritos / seguimiento (Semana 6 / Paso 5).
 * Cliente autenticado + RLS owner-only; nunca service_role.
 */
import type { Database } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type FavoriteRow = Database["public"]["Tables"]["favorites"]["Row"];

export type FavoriteWithTender = FavoriteRow & {
  tenders: {
    id: string;
    title: string;
    status: string | null;
    estimated_value: number | null;
    currency: string;
    cpv_code: string | null;
    publication_date: string | null;
  } | null;
};

/** ¿El usuario tiene esta licitación en favoritos? */
export async function isOwnFavorite(
  client: SupabaseClient<Database>,
  input: { userId: string; tenderId: string },
): Promise<{ data: boolean; error: Error | null }> {
  const { data, error } = await client
    .from("favorites")
    .select("id")
    .eq("user_id", input.userId)
    .eq("tender_id", input.tenderId)
    .maybeSingle();

  if (error) return { data: false, error: new Error(error.message) };
  return { data: Boolean(data), error: null };
}

export async function listOwnFavorites(
  client: SupabaseClient<Database>,
): Promise<{ data: FavoriteWithTender[]; error: Error | null }> {
  const { data, error } = await client
    .from("favorites")
    .select(
      `
      id,
      user_id,
      tender_id,
      created_at,
      tenders (
        id,
        title,
        status,
        estimated_value,
        currency,
        cpv_code,
        publication_date
      )
    `,
    )
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data as FavoriteWithTender[]) ?? [], error: null };
}

export async function addOwnFavorite(
  client: SupabaseClient<Database>,
  input: { userId: string; tenderId: string },
): Promise<{ data: FavoriteRow | null; error: Error | null }> {
  const { data, error } = await client
    .from("favorites")
    .insert({
      user_id: input.userId,
      tender_id: input.tenderId,
    })
    .select("*")
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  return { data, error: null };
}

export async function removeOwnFavorite(
  client: SupabaseClient<Database>,
  input: { userId: string; tenderId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("favorites")
    .delete()
    .eq("user_id", input.userId)
    .eq("tender_id", input.tenderId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}
