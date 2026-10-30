import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@efilicit/types";

/**
 * Refresca cookies de sesión Auth en cada request.
 *
 * Invite-only (ADR 016): sin registro público; `/` anónimo → `/login`.
 * Gate de producto: rutas protegidas abajo — las páginas RSC no deben
 * repetir getUser+redirect; solo leen perfil (`getSessionProfile`) si lo necesitan.
 * Solo publishable/anon — nunca service_role.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (path === "/account" || path.startsWith("/account/")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  // Sin sesión: `/` es solo un salto a la pantalla de login (ya no hay landing intermedia).
  if ((path === "/" || path === "") && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  const isProtected =
    path.startsWith("/alerts") ||
    path.startsWith("/notifications") ||
    path.startsWith("/search") ||
    path.startsWith("/favorites") ||
    path.startsWith("/my-tenders") ||
    path.startsWith("/tenders");

  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", path);
    return NextResponse.redirect(redirectUrl);
  }

  if (path === "/login" && user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
