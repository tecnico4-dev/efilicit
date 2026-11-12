import { NextResponse, type NextRequest } from "next/server";
import {
  getSessionProfile,
  getSupabaseServerClient,
} from "@/lib/auth/session";
import {
  getOwnAlertInterestKindForTender,
  markOwnCommonNotificationRead,
  markOwnNotificationRead,
} from "@/lib/queries";

/**
 * Marca un aviso como leído y redirige a la ficha.
 * Favoritos-estado: /notifications/open?eventId=…&tenderId=…
 * Común: /notifications/open?source=common&tenderId=…
 * Auth: middleware (ruta bajo /notifications).
 */
export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("source")?.trim() ?? "";
  const eventId = request.nextUrl.searchParams.get("eventId")?.trim() ?? "";
  const tenderId = request.nextUrl.searchParams.get("tenderId")?.trim() ?? "";

  const fallback = new URL("/notifications", request.url);
  if (!tenderId) {
    return NextResponse.redirect(fallback);
  }
  if (source !== "common" && !eventId) {
    return NextResponse.redirect(fallback);
  }

  const supabase = await getSupabaseServerClient();
  const { data: profile } = await getSessionProfile();

  let interest: string | null = null;
  if (profile?.id) {
    if (source === "common") {
      await markOwnCommonNotificationRead(supabase, {
        userId: profile.id,
        tenderId,
      });
    } else {
      await markOwnNotificationRead(supabase, {
        userId: profile.id,
        eventId,
      });
    }
    const kindResult = await getOwnAlertInterestKindForTender(supabase, {
      userId: profile.id,
      tenderId,
    });
    if (!kindResult.error) interest = kindResult.data;
  }

  const target = new URL(`/tenders/${tenderId}`, request.url);
  target.searchParams.set("from", source === "common" ? "notifications" : "email");
  if (interest) target.searchParams.set("interest", interest);
  return NextResponse.redirect(target);
}
