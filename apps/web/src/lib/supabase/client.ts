import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@efilicit/types";

function requirePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (copy apps/web/.env.example → .env.local)",
    );
  }

  return { url, key };
}

/**
 * Browser client (Client Components). Publishable/anon key only — never service_role.
 */
export function createSupabaseBrowserClient() {
  const { url, key } = requirePublicEnv();
  return createBrowserClient<Database>(url, key);
}

/**
 * @deprecated Prefer createSupabaseBrowserClient or createSupabaseServerClient.
 * Kept for call sites that only need anon public reads without cookies.
 */
export function createSupabaseClient() {
  return createSupabaseBrowserClient();
}
