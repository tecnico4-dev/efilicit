/**
 * Directorio Eficen (ADR 032). SELECT is_app_user(); sin writes desde la app.
 */
import type { Database } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type EficenMemberForShare = {
  id: string;
  displayName: string;
  roleTitle: string | null;
  /** users.id enlazado (siempre presente en el listado de share). */
  userId: string;
};

/** Ficha del directorio para pickers de Mis licitaciones (responsable / equipo). */
export type EficenMemberForTeam = {
  id: string;
  displayName: string;
  roleTitle: string | null;
  avatarUrl: string | null;
};

/**
 * Miembros activos con cuenta, para el picker «Personas».
 * Excluye al usuario actual (no compartirse a uno mismo).
 */
export async function listEficenMembersForShare(
  client: SupabaseClient<Database>,
  currentUserId: string,
): Promise<{ data: EficenMemberForShare[]; error: Error | null }> {
  const { data, error } = await client
    .from("eficen_members")
    .select("id, display_name, role_title, user_id")
    .eq("active", true)
    .not("user_id", "is", null)
    .order("display_name", { ascending: true });

  if (error) return { data: [], error: new Error(error.message) };

  const rows: EficenMemberForShare[] = [];
  for (const row of data ?? []) {
    if (!row.user_id || row.user_id === currentUserId) continue;
    rows.push({
      id: row.id,
      displayName: row.display_name,
      roleTitle: row.role_title,
      userId: row.user_id,
    });
  }
  return { data: rows, error: null };
}

/**
 * Miembros activos del directorio para responsable / equipo del expediente.
 * No exige cuenta (`user_id`); no excluye al usuario actual.
 */
export async function listEficenMembersForTeam(
  client: SupabaseClient<Database>,
): Promise<{ data: EficenMemberForTeam[]; error: Error | null }> {
  const { data, error } = await client
    .from("eficen_members")
    .select("id, display_name, role_title, avatar_url")
    .eq("active", true)
    .order("display_name", { ascending: true });

  if (error) return { data: [], error: new Error(error.message) };

  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      displayName: row.display_name,
      roleTitle: row.role_title,
      avatarUrl: row.avatar_url,
    })),
    error: null,
  };
}

/** Nombre visible del miembro enlazado a un users.id (o null). */
export async function getEficenMemberDisplayNameByUserId(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<{ data: string | null; error: Error | null }> {
  const { data, error } = await client
    .from("eficen_members")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { data: null, error: new Error(error.message) };
  return { data: data?.display_name ?? null, error: null };
}

/** `eficen_members.id` del usuario (o null si no hay ficha enlazada). */
export async function getEficenMemberIdByUserId(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<{ data: string | null; error: Error | null }> {
  const { data, error } = await client
    .from("eficen_members")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { data: null, error: new Error(error.message) };
  return { data: data?.id ?? null, error: null };
}
