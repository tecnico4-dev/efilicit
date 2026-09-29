import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@efilicit/types";

/**
 * Server client (Server Components, Route Handlers, Server Actions).
 * Publishable/anon key + cookies de sesión. Never service_role.
 */
export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (copy apps/web/.env.example → .env.local)",
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component without mutable cookies — middleware refreshes session.
        }
      },
    },
  });
}
