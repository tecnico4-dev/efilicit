import { redirect } from "next/navigation";
import {
  getSessionProfile,
  getSessionUser,
  getSupabaseServerClient,
} from "@/lib/auth/session";
import {
  countUnreadFavoriteStatusNotifications,
  listOwnAlerts,
  listOwnFavorites,
  listOwnSavedSearches,
  listRecentFavoriteStatusNotifications,
} from "@/lib/queries";
import { HomeDashboard } from "./home-dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  let supabase;
  try {
    supabase = await getSupabaseServerClient();
  } catch {
    redirect("/login");
  }

  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const profile = await getSessionProfile();
  if (!profile.data) {
    redirect("/login");
  }

  const digestFrequency =
    profile.data.digest_frequency === "semanal" ? "semanal" : "diaria";

  const userId = profile.data.id;
  const [
    alertsResult,
    favoritesResult,
    searchesResult,
    unreadResult,
    recentResult,
  ] = await Promise.all([
    listOwnAlerts(supabase),
    listOwnFavorites(supabase),
    listOwnSavedSearches(supabase),
    countUnreadFavoriteStatusNotifications(supabase, { userId }),
    listRecentFavoriteStatusNotifications(supabase, {
      userId,
      limit: 3,
    }),
  ]);

  const loadErrors = [
    alertsResult.error?.message,
    favoritesResult.error?.message,
    searchesResult.error?.message,
    unreadResult.error?.message,
    recentResult.error?.message,
  ].filter((m): m is string => Boolean(m));

  return (
    <HomeDashboard
      displayName={profile.data.display_name?.trim() || ""}
      alerts={alertsResult.data}
      favorites={favoritesResult.data}
      searches={searchesResult.data}
      digestFrequency={digestFrequency}
      unreadCount={unreadResult.data}
      recentNotifications={recentResult.data}
      loadError={
        loadErrors.length
          ? `No se pudo cargar parte del inicio: ${loadErrors.join(" · ")}`
          : null
      }
    />
  );
}
