import { NextResponse, type NextRequest } from "next/server";
import {
  getSessionProfile,
  getSessionUser,
  getSupabaseServerClient,
} from "@/lib/auth/session";
import { markOwnNotificationRead } from "@/lib/queries";

/**
 * Marca un aviso como leído y redirige a la ficha.
 * Uso: /notifications/open?eventId=…&tenderId=…
 */
export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("eventId")?.trim() ?? "";
  const tenderId = request.nextUrl.searchParams.get("tenderId")?.trim() ?? "";

  const fallback = new URL("/notifications", request.url);
  if (!eventId || !tenderId) {
    return NextResponse.redirect(fallback);
  }

  const supabase = await getSupabaseServerClient();
  const user = await getSessionUser();

  if (!user) {
    const login = new URL("/login", request.url);
    login.searchParams.set(
      "next",
      `/notifications/open?eventId=${encodeURIComponent(eventId)}&tenderId=${encodeURIComponent(tenderId)}`,
    );
    return NextResponse.redirect(login);
  }

  const { data: profile } = await getSessionProfile();

  if (profile?.id) {
    await markOwnNotificationRead(supabase, {
      userId: profile.id,
      eventId,
    });
  }

  return NextResponse.redirect(new URL(`/tenders/${tenderId}`, request.url));
}
