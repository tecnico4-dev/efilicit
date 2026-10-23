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
    cpv_codes: string[];
    publication_date: string | null;
    deadline_at: string | null;
    /** max(`tender_sources.last_seen_at`): última vez que una fuente la vio. */
    last_seen_at: string | null;
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

/** IDs de licitaciones favoritas entre un conjunto (p. ej. resultados de búsqueda). */
export async function listOwnFavoriteTenderIds(
  client: SupabaseClient<Database>,
  tenderIds: string[],
): Promise<{ data: Set<string>; error: Error | null }> {
  if (tenderIds.length === 0) {
    return { data: new Set(), error: null };
  }

  const { data, error } = await client
    .from("favorites")
    .select("tender_id")
    .in("tender_id", tenderIds);

  if (error) return { data: new Set(), error: new Error(error.message) };
  return {
    data: new Set((data ?? []).map((row) => row.tender_id)),
    error: null,
  };
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
        publication_date,
        deadline_at,
        tender_cpvs (cpv_code),
        tender_sources!tender_sources_tender_id_fkey (last_seen_at)
      )
    `,
    )
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: new Error(error.message) };

  const rows = (data ?? []).map((row) => {
    const tender = row.tenders as
      | (Omit<
          NonNullable<FavoriteWithTender["tenders"]>,
          "cpv_codes" | "last_seen_at"
        > & {
          tender_cpvs?: { cpv_code: string }[] | null;
          tender_sources?: { last_seen_at: string }[] | null;
        })
      | null;
    if (!tender) {
      return { ...row, tenders: null } as FavoriteWithTender;
    }
    const { tender_cpvs, tender_sources, ...rest } = tender;
    return {
      ...row,
      tenders: {
        ...rest,
        cpv_codes: [...(tender_cpvs ?? []).map((r) => r.cpv_code)].sort(),
        last_seen_at: maxIsoTimestamp(
          (tender_sources ?? []).map((s) => s.last_seen_at),
        ),
      },
    } as FavoriteWithTender;
  });

  return { data: rows, error: null };
}

function maxIsoTimestamp(values: string[]): string | null {
  let best: string | null = null;
  for (const raw of values) {
    if (!raw) continue;
    if (best == null || raw > best) best = raw;
  }
  return best;
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
