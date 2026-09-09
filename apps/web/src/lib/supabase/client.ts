import { createClient } from "@supabase/supabase-js";
import type { Database } from "@efilicit/types";

/**
 * Browser/server client for local development.
 * Uses publishable/anon key only — never the service role.
 */
export function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (copy apps/web/.env.example → .env.local)",
    );
  }

  return createClient<Database>(url, key);
}
