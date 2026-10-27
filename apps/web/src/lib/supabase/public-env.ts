/**
 * Env público de Supabase (URL + publishable/anon).
 * Nunca service_role aquí.
 */

const MISSING_ENV_MESSAGE =
  "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (copia apps/web/.env.example → .env.local)";

export type PublicSupabaseEnv = {
  url: string;
  key: string;
};

/** null si faltan vars (p. ej. CI build / prerender sin .env). */
export function getPublicSupabaseEnv(): PublicSupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;
  return { url, key };
}

/** Para clientes que deben fallar en runtime si no hay configuración. */
export function requirePublicSupabaseEnv(): PublicSupabaseEnv {
  const env = getPublicSupabaseEnv();
  if (!env) {
    throw new Error(MISSING_ENV_MESSAGE);
  }
  return env;
}
