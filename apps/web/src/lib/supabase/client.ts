import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@efilicit/types";
import { requirePublicSupabaseEnv } from "@/lib/supabase/public-env";

/**
 * Cliente de navegador (Client Components).
 * Persiste sesión en cookies vía `@supabase/ssr` (mismo contrato que el server client).
 * Nunca usar aquí service_role (EfiLicit: solo procesos confiables / ETL).
 */
export function createSupabaseBrowserClient() {
  const { url, key } = requirePublicSupabaseEnv();
  return createBrowserClient<Database>(url, key);
}

/**
 * Alias histórico del cliente público (home / health-check Fase 0).
 * Preferir `createSupabaseBrowserClient` o `createSupabaseServerClient` en código nuevo.
 */
export function createSupabaseClient() {
  return createSupabaseBrowserClient();
}
