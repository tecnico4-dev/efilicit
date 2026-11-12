import { NextResponse, type NextRequest } from "next/server";
import {
  getSessionProfile,
  getSupabaseServerClient,
} from "@/lib/auth/session";
import {
  getOwnAlertInterestKindForTender,
  markOwnNotificationRead,
} from "@/lib/queries";

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

  let interest: string | null = null;
  if (profile?.id) {
    await markOwnNotificationRead(supabase, {
      userId: profile.id,
      eventId,
    });
    const kindResult = await getOwnAlertInterestKindForTender(supabase, {
      userId: profile.id,
      tenderId,
    });
    if (!kindResult.error) interest = kindResult.data;
  }

  const target = new URL(`/tenders/${tenderId}`, request.url);
  target.searchParams.set("from", "email");
  if (interest) target.searchParams.set("interest", interest);
  return NextResponse.redirect(target);
}
