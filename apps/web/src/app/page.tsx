import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getOwnProfile,
  listFavoriteStatusNotifications,
  listOwnAlerts,
  listOwnFavorites,
  listOwnSavedSearches,
} from "@/lib/queries";
import { HomeDashboard } from "./home-dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    redirect("/login");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getOwnProfile(supabase);
  if (!profile.data) {
    redirect("/login");
  }

  const digestFrequency =
    profile.data.digest_frequency === "semanal" ? "semanal" : "diaria";

  const [alertsResult, favoritesResult, searchesResult, notificationsResult] =
    await Promise.all([
      listOwnAlerts(supabase),
      listOwnFavorites(supabase),
      listOwnSavedSearches(supabase),
      listFavoriteStatusNotifications(supabase, {
        userId: profile.data.id,
        limit: 50,
      }),
    ]);

  const notifications = notificationsResult.data;
  const unreadCount = notifications.filter((n) => n.unread).length;
  const recentNotifications = notifications.slice(0, 3);

  const loadErrors = [
    alertsResult.error?.message,
    favoritesResult.error?.message,
    searchesResult.error?.message,
    notificationsResult.error?.message,
  ].filter((m): m is string => Boolean(m));

  return (
    <HomeDashboard
      displayName={profile.data.display_name?.trim() || ""}
      alerts={alertsResult.data}
      favorites={favoritesResult.data}
      searches={searchesResult.data}
      digestFrequency={digestFrequency}
      unreadCount={unreadCount}
      recentNotifications={recentNotifications}
      loadError={
        loadErrors.length
          ? `No se pudo cargar parte del inicio: ${loadErrors.join(" · ")}`
          : null
      }
    />
  );
}
