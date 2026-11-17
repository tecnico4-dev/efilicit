import {
  getSessionProfile,
  getSupabaseServerClient,
} from "@/lib/auth/session";
import { PAGE_MAIN_MEDIUM_CLASS } from "@/components/shell/page-width";
import { ErrorState } from "@/components/ui/state-message";
import {
  countUnreadNotifications,
  listOwnAlerts,
  listOwnFavoriteShares,
  listOwnFavorites,
  listOwnRecommendations,
  listOwnSavedSearches,
  listRecentFavoriteStatusNotifications,
  listSharedFavorites,
} from "@/lib/queries";
import { HomeDashboard } from "./home-dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  let supabase;
  try {
    supabase = await getSupabaseServerClient();
  } catch {
    return (
      <main className={PAGE_MAIN_MEDIUM_CLASS}>
        <ErrorState>No se pudo conectar con la base de datos.</ErrorState>
      </main>
    );
  }

  // Auth: middleware. Aquí solo hace falta el perfil de aplicación.
  const profile = await getSessionProfile();
  if (!profile.data) {
    return (
      <main className={PAGE_MAIN_MEDIUM_CLASS}>
        <ErrorState>
          No hay perfil en public.users:{" "}
          {profile.error?.message ?? "desconocido"}
        </ErrorState>
      </main>
    );
  }

  const digestFrequency =
    profile.data.digest_frequency === "semanal" ? "semanal" : "diaria";

  const userId = profile.data.id;
  const [
    alertsResult,
    favoritesResult,
    sharedResult,
    searchesResult,
    unreadResult,
    recentResult,
    recommendationsResult,
    peerSharesResult,
  ] = await Promise.all([
    listOwnAlerts(supabase),
    listOwnFavorites(supabase),
    listSharedFavorites(supabase),
    listOwnSavedSearches(supabase),
    countUnreadNotifications(supabase, { userId }),
    listRecentFavoriteStatusNotifications(supabase, {
      userId,
      limit: 3,
    }),
    listOwnRecommendations(supabase, { userId, limitPerKind: 5 }),
    listOwnFavoriteShares(supabase, userId),
  ]);

  const receivedShares = peerSharesResult.data.filter(
    (s) => s.direction === "received",
  );

  const loadErrors = [
    alertsResult.error?.message,
    favoritesResult.error?.message,
    sharedResult.error?.message,
    searchesResult.error?.message,
    unreadResult.error?.message,
    recentResult.error?.message,
    recommendationsResult.error?.message,
    peerSharesResult.error?.message,
  ].filter((m): m is string => Boolean(m));

  return (
    <HomeDashboard
      displayName={profile.data.display_name?.trim() || ""}
      userId={userId}
      alerts={alertsResult.data}
      favorites={favoritesResult.data}
      sharedFavorites={sharedResult.data}
      receivedShares={receivedShares}
      searches={searchesResult.data}
      digestFrequency={digestFrequency}
      unreadCount={unreadResult.data}
      recentNotifications={recentResult.data}
      recommendations={recommendationsResult.data}
      loadError={
        loadErrors.length
          ? `No se pudo cargar parte del inicio: ${loadErrors.join(" · ")}`
          : null
      }
    />
  );
}
