import { PAGE_MAIN_CLASS } from "@/components/shell/page-width";
import { EmptyState, ErrorState } from "@/components/ui/state-message";
import {
  getSessionProfile,
  getSupabaseServerClient,
} from "@/lib/auth/session";
import {
  listMunicipalityNamesByCodes,
  listOwnSavedSearches,
  type DigestFrequency,
} from "@/lib/queries";
import { parseCriteria } from "@/lib/criteria-display";
import { EmptySavedSearchesHint } from "../empty-hints";
import { PaginatedSavedSearches } from "../paginated-saved-searches";

export const dynamic = "force-dynamic";

export default async function SavedSearchesPage() {
  const supabase = await getSupabaseServerClient();
  const profile = await getSessionProfile();
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

  const { data: searches, error } = await listOwnSavedSearches(supabase);
  const municipalityNames = await listMunicipalityNamesByCodes(
    supabase,
    searches.flatMap(
      (s) => parseCriteria(s.criteria).geography?.municipality_codes ?? [],
    ),
  );

  return (
    <main className={PAGE_MAIN_CLASS}>
      {error ? (
        <ErrorState>{error.message}</ErrorState>
      ) : searches.length === 0 ? (
        <EmptyState>
          <EmptySavedSearchesHint />
        </EmptyState>
      ) : (
        <PaginatedSavedSearches
          searches={searches}
          userId={profile.data.id}
          digestFrequency={digestFrequency}
          searchFrom="favorites-searches"
          municipalityNames={municipalityNames}
        />
      )}
    </main>
  );
}
