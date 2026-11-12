import {
  PAGE_MAIN_CLASS,
  PAGE_TITLE_RULE,
} from "@/components/shell/page-width";
import { EmptyState, ErrorState } from "@/components/ui/state-message";
import {
  getSessionProfile,
  getSupabaseServerClient,
} from "@/lib/auth/session";
import {
  listOwnFavorites,
  listSharedFavoriteTenderIds,
} from "@/lib/queries";
import { EmptyFavoritesTendersHint } from "../empty-hints";
import { PaginatedFavoriteTenders } from "../paginated-favorite-tenders";

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

  const { data: favorites, error } = await listOwnFavorites(supabase);
  const tenderIds = favorites
    .map((f) => f.tenders?.id)
    .filter((id): id is string => Boolean(id));
  const sharedIdsResult = await listSharedFavoriteTenderIds(
    supabase,
    tenderIds,
  );

  return (
    <main className={PAGE_MAIN_CLASS}>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Licitaciones favoritas
      </h1>

      <div className={PAGE_TITLE_RULE}>
        {error ? (
          <ErrorState>{error.message}</ErrorState>
        ) : favorites.length === 0 ? (
          <EmptyState>
            <EmptyFavoritesTendersHint />
          </EmptyState>
        ) : (
          <PaginatedFavoriteTenders
            favorites={favorites}
            from="favorites-tenders"
            shareUserId={profile.data.id}
            sharedTenderIds={sharedIdsResult.data}
          />
        )}
      </div>
    </main>
  );
}
