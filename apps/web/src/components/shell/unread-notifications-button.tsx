import { getSupabaseServerClient } from "@/lib/auth/session";
import { hasUnreadNotifications } from "@/lib/queries";
import { NotificationsButton } from "./notifications-button";

/**
 * Resuelve el puntito de no leídas (RPC EXISTS: favoritos + digests).
 * Pensado para ir dentro de `<Suspense>` y no bloquear el layout.
 */
export async function UnreadNotificationsButton({
  userId,
}: {
  userId: string;
}) {
  const supabase = await getSupabaseServerClient();
  const unread = await hasUnreadNotifications(supabase, {
    userId,
  });
  return <NotificationsButton hasUnread={unread.data} />;
}
