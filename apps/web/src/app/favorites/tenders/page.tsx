import type { CriteriaFilterOptionsProp } from "@/components/criteria/criteria-filters";
import { PAGE_MAIN_CLASS } from "@/components/shell/page-width";
import { EmptyState, ErrorState } from "@/components/ui/state-message";
import {
  getSessionProfile,
  getSupabaseServerClient,
} from "@/lib/auth/session";
import {
  listOwnFavorites,
  listSearchFilterOptions,
  listSharedFavoriteOwners,
} from "@/lib/queries";
import { EmptyFavoritesTendersHint } from "../empty-hints";
import { OwnFavoritesSection } from "../own-favorites-section";

export const dynamic = "force-dynamic";

export default async function FavoriteTendersPage() {
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

  const userId = profile.data.id;
  const [favoritesResult, filterListed] = await Promise.all([
    listOwnFavorites(supabase),
    listSearchFilterOptions(supabase),
  ]);
  const { data: favorites, error } = favoritesResult;
  const filterOptions: CriteriaFilterOptionsProp = filterListed.error
    ? {
        statuses: [],
        procedureTypes: [],
        contractTypes: [],
        ccaaCodesWithTenders: [],
      }
    : {
        statuses: filterListed.data.statuses,
        procedureTypes: filterListed.data.procedureTypes,
        contractTypes: filterListed.data.contractTypes,
        ccaaCodesWithTenders: [...filterListed.data.ccaaCodesWithTenders],
      };
  const tenderIds = favorites
    .map((f) => f.tenders?.id)
    .filter((id): id is string => Boolean(id));
  const sharedOwnersResult = await listSharedFavoriteOwners(
    supabase,
    tenderIds,
  );
  const sharedOwners = Object.fromEntries(sharedOwnersResult.data);

  return (
    <main className={PAGE_MAIN_CLASS}>
      {error ? (
        <ErrorState>{error.message}</ErrorState>
      ) : favorites.length === 0 ? (
        <EmptyState>
          <EmptyFavoritesTendersHint />
        </EmptyState>
      ) : (
        <OwnFavoritesSection
          favorites={favorites}
          userId={userId}
          sharedOwners={sharedOwners}
          filterOptions={filterOptions}
        />
      )}
    </main>
  );
}
