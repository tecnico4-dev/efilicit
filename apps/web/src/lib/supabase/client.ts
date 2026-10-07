import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@efilicit/types";

/**
 * Lee URL + publishable/anon key del entorno público.
 * Nunca usar aquí service_role (EfiLicit: solo procesos confiables / ETL).
 */
function requirePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (copia apps/web/.env.example → .env.local)",
    );
  }

  return { url, key };
}

/**
 * Cliente de navegador (Client Components).
 * Persiste sesión en cookies vía `@supabase/ssr` (mismo contrato que el server client).
 */
export function createSupabaseBrowserClient() {
  const { url, key } = requirePublicEnv();
  return createBrowserClient<Database>(url, key);
}

/**
 * Alias histórico del cliente público (home / health-check Fase 0).
 * Preferir `createSupabaseBrowserClient` o `createSupabaseServerClient` en código nuevo.
 */
export function createSupabaseClient() {
  return createSupabaseBrowserClient();
}
