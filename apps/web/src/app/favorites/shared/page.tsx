import type { CriteriaFilterOptionsProp } from "@/components/criteria/criteria-filters";
import { PAGE_MAIN_FAVORITES_CLASS } from "@/components/shell/page-width";
import { EmptyState, ErrorState } from "@/components/ui/state-message";
import {
  getSessionProfile,
  getSupabaseServerClient,
} from "@/lib/auth/session";
import { listOwnFavoriteShares, listSearchFilterOptions } from "@/lib/queries";
import { EmptyPeerSharesHint } from "../empty-hints";
import { PeerSharesSection } from "../peer-shares-section";

export const dynamic = "force-dynamic";

export default async function PeerSharedFavoritesPage() {
  const supabase = await getSupabaseServerClient();
  const profile = await getSessionProfile();
  if (!profile.data) {
    return (
      <main className={PAGE_MAIN_FAVORITES_CLASS}>
        <ErrorState>
          No hay perfil en public.users:{" "}
          {profile.error?.message ?? "desconocido"}
        </ErrorState>
      </main>
    );
  }

  const [sharesResult, filterListed] = await Promise.all([
    listOwnFavoriteShares(supabase, profile.data.id),
    listSearchFilterOptions(supabase),
  ]);
  const { data: items, error } = sharesResult;
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
    <main className={`${PAGE_MAIN_FAVORITES_CLASS} overflow-visible`}>
      {error ? (
        <ErrorState>{error.message}</ErrorState>
      ) : items.length === 0 ? (
        <EmptyState>
          <EmptyPeerSharesHint />
        </EmptyState>
      ) : (
        <PeerSharesSection items={items} filterOptions={filterOptions} />
      )}
    </main>
  );
}
