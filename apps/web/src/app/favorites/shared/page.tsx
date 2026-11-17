import type { CriteriaFilterOptionsProp } from "@/components/criteria/criteria-filters";
import {
  PAGE_MAIN_FAVORITES_CLASS,
  PAGE_MAIN_WIDE_CLASS,
} from "@/components/shell/page-width";
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

  // Ancho completo para que el rail quepa a la izquierda del max-w-7xl del listado.
  return (
    <main className={PAGE_MAIN_WIDE_CLASS}>
      {error ? (
        <div className={PAGE_MAIN_FAVORITES_CLASS}>
          <ErrorState>{error.message}</ErrorState>
        </div>
      ) : items.length === 0 ? (
        <div className={PAGE_MAIN_FAVORITES_CLASS}>
          <EmptyState>
            <EmptyPeerSharesHint />
          </EmptyState>
        </div>
      ) : (
        <PeerSharesSection items={items} filterOptions={filterOptions} />
      )}
    </main>
  );
}
