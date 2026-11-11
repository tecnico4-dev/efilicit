import {
  getSessionProfile,
  getSupabaseServerClient,
} from "@/lib/auth/session";
import {
  listMunicipalityNamesByCodes,
  listOwnFavorites,
  listOwnSavedSearches,
  type DigestFrequency,
} from "@/lib/queries";
import { parseCriteria } from "@/lib/criteria-display";
import {
  EmptyFavoritesTendersHint,
  EmptySavedSearchesHint,
} from "./empty-hints";
import {
  PAGE_MAIN_WIDE_CLASS,
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

const PANEL_CLASS =
  "mt-0 flex h-full min-h-0 flex-col rounded-lg border border-border bg-surface/40 px-4 py-4 sm:px-5";

export default async function FavoritesPage() {
  const supabase = await getSupabaseServerClient();
  const profile = await getSessionProfile();
  if (!profile.data) {
    return (
      <main className={PAGE_MAIN_WIDE_CLASS}>
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
  const municipalityNames = await listMunicipalityNamesByCodes(
    supabase,
    searches.flatMap(
      (s) => parseCriteria(s.criteria).geography?.municipality_codes ?? [],
    ),
  );

  return (
    <main className={PAGE_MAIN_WIDE_CLASS}>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Favoritos
      </h1>

      <div
        className={`${PAGE_TITLE_RULE} grid grid-cols-1 items-stretch gap-8 lg:grid-cols-3 lg:gap-6`}
      >
        <PreviewSection
          title="Licitaciones favoritas"
          emptyMessage={<EmptyFavoritesTendersHint />}
          error={favoritesResult.error?.message ?? null}
          totalCount={favorites.length}
          moreHref="/favorites/tenders"
          className={PANEL_CLASS}
        >
          <FavoriteTenderList
            favorites={favorites.slice(0, FAVORITES_PREVIEW_LIMIT)}
            bordered={false}
          />
        </PreviewSection>

        {/* Hueco provisional: contenido pendiente (nombre final TBD). */}
        <section className={PANEL_CLASS} aria-labelledby="shared-tenders-heading">
          <h2
            id="shared-tenders-heading"
            className="text-xl font-semibold tracking-tight text-foreground"
          >
            Licitaciones compartidas
          </h2>
        </section>

        <PreviewSection
          title="Búsquedas guardadas"
          emptyMessage={<EmptySavedSearchesHint />}
          error={searchesResult.error?.message ?? null}
          totalCount={searches.length}
          moreHref="/favorites/searches"
          className={PANEL_CLASS}
        >
          <SavedSearchList
            searches={searches.slice(0, FAVORITES_PREVIEW_LIMIT)}
            userId={profile.data.id}
            digestFrequency={digestFrequency}
            searchFrom="favorites"
            municipalityNames={municipalityNames}
            bordered={false}
          />
        </PreviewSection>
      </div>
    </main>
  );
}
