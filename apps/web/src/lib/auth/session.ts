/**
 * Sesión Auth + perfil `public.users` memoizados por request (React `cache`).
 *
 * Gate de acceso: el middleware (`updateSession`) ya redirige anónimos a `/login`
 * en rutas de producto. Las páginas no deben repetir `getUser` + redirect;
 * solo necesitan el perfil de aplicación (`public.users`) cuando usen `userId`.
 *
 * Sin env público de Supabase (p. ej. `next build` en CI al prerenderizar
 * `/_not-found` con el chrome del layout): se trata como “sin sesión”, no throw.
 */
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@efilicit/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicSupabaseEnv } from "@/lib/supabase/public-env";

export type SessionProfile = Database["public"]["Tables"]["users"]["Row"];

/** Alias del cliente RSC (ya memoizado en `server.ts`). */
export const getSupabaseServerClient = createSupabaseServerClient;

/** Auth user de la sesión actual (una llamada a getUser por request). */
export const getSessionUser = cache(async (): Promise<User | null> => {
  if (!getPublicSupabaseEnv()) {
    return null;
  }

  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    // Prerender / entorno sin cookies / Auth no alcanzable → anónimo.
    return null;
  }
});

/**
 * Perfil de aplicación ligado al auth user.
 * Una lectura de `public.users` por request.
 */
export const getSessionProfile = cache(
  async (): Promise<{
    data: SessionProfile | null;
    error: Error | null;
  }> => {
    const user = await getSessionUser();
    if (!user) {
      return { data: null, error: new Error("No hay sesión") };
    }

    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (error) return { data: null, error: new Error(error.message) };
    return { data, error: null };
  },
);
