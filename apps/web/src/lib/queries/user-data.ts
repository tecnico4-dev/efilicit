import type { Database, SearchCriteria } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type AlertRow = Database["public"]["Tables"]["alerts"]["Row"];
type SavedSearchRow = Database["public"]["Tables"]["saved_searches"]["Row"];
type ProfileRow = Database["public"]["Tables"]["users"]["Row"];
type Json = Database["public"]["Tables"]["alerts"]["Insert"]["criteria"];

export type DigestFrequency = "daily" | "weekly";

function asJson(criteria: SearchCriteria): Json {
  return criteria as unknown as Json;
}

export async function getOwnProfile(
  client: SupabaseClient<Database>,
): Promise<{ data: ProfileRow | null; error: Error | null }> {
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError || !user) {
    return { data: null, error: new Error(authError?.message ?? "No hay sesión") };
  }

  const { data, error } = await client
    .from("users")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) return { data: null, error: new Error(error.message) };
  return { data, error: null };
}

export async function updateOwnDigestFrequency(
  client: SupabaseClient<Database>,
  input: {
    userId: string;
    digestFrequency: DigestFrequency;
  },
): Promise<{ data: ProfileRow | null; error: Error | null }> {
  const frequency = input.digestFrequency;

  const { data, error } = await client
    .from("users")
    .update({ digest_frequency: frequency, updated_at: new Date().toISOString() })
    .eq("id", input.userId)
    .select("*")
    .single();

  if (error) return { data: null, error: new Error(error.message) };

  // Mantener alerts.frequency alineada con la preferencia de cuenta.
  const { error: syncError } = await client
    .from("alerts")
    .update({ frequency, updated_at: new Date().toISOString() })
    .eq("user_id", input.userId);

  if (syncError) return { data: null, error: new Error(syncError.message) };
  return { data, error: null };
}

export async function listOwnAlerts(
  client: SupabaseClient<Database>,
): Promise<{ data: AlertRow[]; error: Error | null }> {
  const { data, error } = await client
    .from("alerts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: new Error(error.message) };
  return { data: data ?? [], error: null };
}

export async function createOwnAlert(
  client: SupabaseClient<Database>,
  input: {
    userId: string;
    name: string;
    criteria: SearchCriteria;
    frequency?: DigestFrequency;
  },
): Promise<{ data: AlertRow | null; error: Error | null }> {
  const { data, error } = await client
    .from("alerts")
    .insert({
      user_id: input.userId,
      name: input.name,
      criteria: asJson(input.criteria),
      frequency: input.frequency ?? "daily",
      is_active: true,
    })
    .select("*")
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  return { data, error: null };
}

export async function listOwnSavedSearches(
  client: SupabaseClient<Database>,
): Promise<{ data: SavedSearchRow[]; error: Error | null }> {
  const { data, error } = await client
    .from("saved_searches")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: new Error(error.message) };
  return { data: data ?? [], error: null };
}

export async function createOwnSavedSearch(
  client: SupabaseClient<Database>,
  input: {
    userId: string;
    name: string;
    criteria: SearchCriteria;
  },
): Promise<{ data: SavedSearchRow | null; error: Error | null }> {
  const { data, error } = await client
    .from("saved_searches")
    .insert({
      user_id: input.userId,
      name: input.name,
      criteria: asJson(input.criteria),
    })
    .select("*")
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  return { data, error: null };
}
