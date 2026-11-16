import { NextResponse, type NextRequest } from "next/server";
import {
  getSessionProfile,
  getSupabaseServerClient,
} from "@/lib/auth/session";
import {
  markOwnCommonNotificationRead,
  markOwnCommonRemovedNotificationRead,
  markOwnNotificationRead,
} from "@/lib/queries";

/**
 * Marca un aviso como leído y redirige a la ficha.
 * Favoritos-estado: /notifications/open?eventId=…&tenderId=…
 * Común alta: /notifications/open?source=common&tenderId=…
 * Común retirada: /notifications/open?source=common-removed&tenderId=…
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
  const isCommonSource =
    source === "common" || source === "common-removed";
  if (!isCommonSource && !eventId) {
    return NextResponse.redirect(fallback);
  }

  const supabase = await getSupabaseServerClient();
  const { data: profile } = await getSessionProfile();

  if (profile?.id) {
    if (source === "common") {
      await markOwnCommonNotificationRead(supabase, {
        userId: profile.id,
        tenderId,
      });
    } else if (source === "common-removed") {
      await markOwnCommonRemovedNotificationRead(supabase, {
        userId: profile.id,
        tenderId,
      });
    } else {
      // Cambio de estado (favoritos/Común): marcar leído; sin valoración en ficha.
      await markOwnNotificationRead(supabase, {
        userId: profile.id,
        eventId,
      });
    }
  }

  const target = new URL(`/tenders/${tenderId}`, request.url);
  // Alta Común → volver a Común, sin valoración.
  // Retirada Común → sin «volver» ni valoración.
  // Cambio de estado → sin valoración (valoración solo digest/alertas).
  const from =
    source === "common"
      ? "favorites-common"
      : source === "common-removed"
        ? "common-removed"
        : "favorite-status";
  target.searchParams.set("from", from);
  return NextResponse.redirect(target);
}
