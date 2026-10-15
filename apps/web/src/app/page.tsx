import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getOwnProfile,
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
}
