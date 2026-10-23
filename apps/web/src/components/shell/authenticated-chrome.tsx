import {
  getSessionProfile,
  getSessionUser,
} from "@/lib/auth/session";
import type { DigestFrequency } from "@/lib/queries";
import { Suspense } from "react";
import { AppHeader } from "./app-header";
import { NotificationsButton } from "./notifications-button";
import { UnreadNotificationsButton } from "./unread-notifications-button";

function displayNameFrom(
  profileName: string | null | undefined,
  metaName: unknown,
  email: string | null | undefined,
): string {
  if (profileName?.trim()) return profileName.trim();
  if (typeof metaName === "string" && metaName.trim()) return metaName.trim();
  if (email?.includes("@")) return email.split("@")[0] ?? "Usuario";
  return "Usuario";
}

/**
 * Cabecera autenticada (async). El badge de no leídas va en Suspense anidado
 * para no retrasar ni el chrome ni `{children}` del layout.
 * Sin sesión (p. ej. `/login`): no pinta nav — el gate de rutas es el middleware.
 */
export async function AuthenticatedChrome() {
  const user = await getSessionUser();
  if (!user) return null;

  const { data: profile } = await getSessionProfile();
  const displayName = displayNameFrom(
    profile?.display_name,
    user.user_metadata?.display_name,
    user.email,
  );
  const userId = profile?.id ?? "";
  const digestFrequency: DigestFrequency =
    profile?.digest_frequency === "semanal" ? "semanal" : "diaria";

  const notifications = userId ? (
    <Suspense fallback={<NotificationsButton hasUnread={false} />}>
      <UnreadNotificationsButton userId={userId} />
    </Suspense>
  ) : (
    <NotificationsButton hasUnread={false} />
  );

  return (
    <AppHeader
      isAuthenticated
      displayName={displayName}
      userId={userId}
      digestFrequency={digestFrequency}
      notifications={notifications}
    />
  );
}
