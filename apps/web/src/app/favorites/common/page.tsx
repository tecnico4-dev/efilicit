import type { CriteriaFilterOptionsProp } from "@/components/criteria/criteria-filters";
import { PAGE_MAIN_CLASS } from "@/components/shell/page-width";
import { EmptyState, ErrorState } from "@/components/ui/state-message";
import {
  getSessionProfile,
  getSupabaseServerClient,
} from "@/lib/auth/session";
import {
  listSearchFilterOptions,
  listSharedFavorites,
} from "@/lib/queries";
import { EmptySharedFavoritesHint } from "../empty-hints";
import { CommonFavoritesSection } from "../common-favorites-section";

export const dynamic = "force-dynamic";

export default async function SharedFavoritesPage() {
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

  const [sharedResult, filterListed] = await Promise.all([
    listSharedFavorites(supabase),
    listSearchFilterOptions(supabase),
  ]);
  const { data: items, error } = sharedResult;
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

  return (
    <main className={PAGE_MAIN_CLASS}>
      {error ? (
        <ErrorState>{error.message}</ErrorState>
      ) : items.length === 0 ? (
        <EmptyState>
          <EmptySharedFavoritesHint />
        </EmptyState>
      ) : (
        <CommonFavoritesSection
          items={items}
          currentUserId={profile.data.id}
          filterOptions={filterOptions}
        />
      )}
    </main>
  );
}
