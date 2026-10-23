import { NextResponse, type NextRequest } from "next/server";
import {
  getSessionProfile,
  getSupabaseServerClient,
} from "@/lib/auth/session";
import { markOwnNotificationRead } from "@/lib/queries";

/**
 * Marca un aviso como leído y redirige a la ficha.
 * Uso: /notifications/open?eventId=…&tenderId=…
 * Auth: middleware (ruta bajo /notifications).
 */
export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("eventId")?.trim() ?? "";
  const tenderId = request.nextUrl.searchParams.get("tenderId")?.trim() ?? "";

  const fallback = new URL("/notifications", request.url);
  if (!eventId || !tenderId) {
    return NextResponse.redirect(fallback);
  }

  const supabase = await getSupabaseServerClient();
  const { data: profile } = await getSessionProfile();

  if (profile?.id) {
    await markOwnNotificationRead(supabase, {
      userId: profile.id,
      eventId,
    });
  }

  return NextResponse.redirect(new URL(`/tenders/${tenderId}`, request.url));
}
