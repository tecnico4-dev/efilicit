import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getOwnProfile,
  listOwnFavorites,
  listOwnSavedSearches,
  type DigestFrequency,
} from "@/lib/queries";
import {
  EmptyFavoritesTendersHint,
  EmptySavedSearchesHint,
} from "./empty-hints";
import {
  PAGE_MAIN_CLASS,
  PAGE_TITLE_RULE,
} from "@/components/shell/page-width";
import { ErrorState } from "@/components/ui/state-message";
import {
  FAVORITES_PREVIEW_LIMIT,
  FavoriteTenderList,
  PreviewSection,
  SavedSearchList,
} from "./favorites-shared";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/favorites");
  }

  const profile = await getOwnProfile(supabase);
  if (!profile.data) {
    return (
      <main className={PAGE_MAIN_CLASS}>
        <ErrorState>
          No hay perfil en public.users:{" "}
          {profile.error?.message ?? "desconocido"}
        </ErrorState>
      </main>
    );
  }

  const digestFrequency: DigestFrequency =
    profile.data.digest_frequency === "semanal" ? "semanal" : "diaria";

  const [favoritesResult, searchesResult] = await Promise.all([
    listOwnFavorites(supabase),
    listOwnSavedSearches(supabase),
  ]);

  const favorites = favoritesResult.data;
  const searches = searchesResult.data;

  return (
    <main className={PAGE_MAIN_CLASS}>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Favoritos
      </h1>

      <div className={PAGE_TITLE_RULE}>
        <PreviewSection
          title="Licitaciones favoritas"
          emptyMessage={<EmptyFavoritesTendersHint />}
          error={favoritesResult.error?.message ?? null}
          totalCount={favorites.length}
          moreHref="/favorites/tenders"
          className="mt-0"
        >
          <FavoriteTenderList
            favorites={favorites.slice(0, FAVORITES_PREVIEW_LIMIT)}
          />
        </PreviewSection>

        <PreviewSection
          title="Búsquedas guardadas"
          emptyMessage={<EmptySavedSearchesHint />}
          error={searchesResult.error?.message ?? null}
          totalCount={searches.length}
          moreHref="/favorites/searches"
        >
          <SavedSearchList
            searches={searches.slice(0, FAVORITES_PREVIEW_LIMIT)}
            userId={profile.data.id}
            digestFrequency={digestFrequency}
            searchFrom="favorites"
          />
        </PreviewSection>
      </div>
    </main>
  );
}
