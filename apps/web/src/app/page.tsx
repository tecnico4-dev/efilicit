import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getOwnProfile,
  listOwnAlerts,
  listOwnFavorites,
  listOwnSavedSearches,
} from "@/lib/queries";
import { HomeDashboard, HomeLanding } from "./home-dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return <HomeLanding />;
    }

    const profile = await getOwnProfile(supabase);
    if (!profile.data) {
      return <HomeLanding />;
    }

    const digestFrequency =
      profile.data.digest_frequency === "semanal" ? "semanal" : "diaria";

    const [alertsResult, favoritesResult, searchesResult] = await Promise.all([
      listOwnAlerts(supabase),
      listOwnFavorites(supabase),
      listOwnSavedSearches(supabase),
    ]);

    return (
      <HomeDashboard
        alerts={alertsResult.data}
        favorites={favoritesResult.data}
        searches={searchesResult.data}
        digestFrequency={digestFrequency}
      />
    );
  } catch {
    return <HomeLanding />;
  }
}
