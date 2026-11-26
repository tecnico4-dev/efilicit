/**
 * Cliente Supabase con service_role — solo Server Actions / código servidor.
 * Nunca importar desde el cliente.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@efilicit/types";

export function getServiceRoleKey(): string | null {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    null
  );
}

export function createOfferIntakeAdminClient(): SupabaseClient<Database> | null {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim();
  const key = getServiceRoleKey();
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
