import { PAGE_MAIN_FAVORITES_CLASS } from "@/components/shell/page-width";
import { EmptyState, ErrorState } from "@/components/ui/state-message";
import {
  getSessionProfile,
  getSupabaseServerClient,
} from "@/lib/auth/session";
import { listOwnFavoriteShares } from "@/lib/queries";
import { EmptyPeerSharesHint } from "../empty-hints";
import { PeerSharesList } from "../peer-shares-list";

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

  const { data: items, error } = await listOwnFavoriteShares(
    supabase,
    profile.data.id,
  );

  return (
    <main className={PAGE_MAIN_FAVORITES_CLASS}>
      {error ? (
        <ErrorState>{error.message}</ErrorState>
      ) : items.length === 0 ? (
        <EmptyState>
          <EmptyPeerSharesHint />
        </EmptyState>
      ) : (
        <PeerSharesList items={items} />
      )}
    </main>
  );
}
