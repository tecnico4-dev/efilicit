import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Database } from "@efilicit/types";

/**
 * Cliente de servidor (Server Components, Route Handlers, Server Actions).
 *
 * Publishable/anon key + cookies de sesión Auth. Nunca `service_role`
 * (solo procesos confiables / ETL). El middleware refresca la sesión cuando
 * este cliente no puede mutar cookies desde un Server Component.
 *
 * Memoizado por request (`cache`) para que layout y página compartan instancia.
 */
export const createSupabaseServerClient = cache(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (copia apps/web/.env.example → .env.local)",
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
          // Componente de servidor sin cookies mutables — el middleware refresca la sesión.
        }
      },
    },
  });
});
