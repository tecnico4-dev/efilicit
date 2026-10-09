/**
 * Acceso a datos de usuario bajo RLS (Semana 5 / Paso 6).
 *
 * Alertas, búsquedas guardadas y perfil (`public.users`) con el cliente
 * autenticado (anon/publishable + sesión). Nunca service_role.
 *
 * `digest_frequency` es preferencia de cuenta (ADR 013): al cambiarla se
 * sincroniza `alerts.frequency` para no dejar reglas con cadencia obsoleta.
 */
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

/** Perfil de aplicación ligado al `auth.users` de la sesión actual. */
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

/**
 * Actualiza la frecuencia de digest de la cuenta y alinea `alerts.frequency`.
 * Valores: daily | weekly (`instant` fuera del MVP).
 */
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

/** Lista alertas del usuario (RLS filtra por owner). */
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

/** Crea una alerta propia con Criteria v1 (criteria vacío no generará matches). */
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

/** Actualiza nombre, criteria y/o is_active de una alerta propia (RLS). */
export async function updateOwnAlert(
  client: SupabaseClient<Database>,
  input: {
    alertId: string;
    name?: string;
    criteria?: SearchCriteria;
    isActive?: boolean;
  },
): Promise<{ data: AlertRow | null; error: Error | null }> {
  const patch: Database["public"]["Tables"]["alerts"]["Update"] = {
    updated_at: new Date().toISOString(),
  };
  if (input.name !== undefined) patch.name = input.name;
  if (input.criteria !== undefined) patch.criteria = asJson(input.criteria);
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  const { data, error } = await client
    .from("alerts")
    .update(patch)
    .eq("id", input.alertId)
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

/** Borra una búsqueda guardada propia (RLS). */
export async function deleteOwnSavedSearch(
  client: SupabaseClient<Database>,
  input: { searchId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("saved_searches")
    .delete()
    .eq("id", input.searchId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/** Borra una alerta propia (RLS). */
export async function deleteOwnAlert(
  client: SupabaseClient<Database>,
  input: { alertId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client.from("alerts").delete().eq("id", input.alertId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/** ¿Ya hay una alerta propia con ese nombre? (comparación sin distinguir mayúsculas). */
export async function ownAlertNameTaken(
  client: SupabaseClient<Database>,
  input: { name: string; excludeAlertId?: string },
): Promise<{ taken: boolean; error: Error | null }> {
  const { data, error } = await listOwnAlerts(client);
  if (error) return { taken: false, error };
  const needle = input.name.trim().toLowerCase();
  const taken = data.some(
    (a) =>
      a.name.trim().toLowerCase() === needle &&
      a.id !== input.excludeAlertId,
  );
  return { taken, error: null };
}
