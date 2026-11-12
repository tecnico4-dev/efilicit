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
  favoriteKindLongLabel,
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

  const userId = profile.data.id;
  const { data: favorites, error } = await listOwnFavorites(supabase);
  const tenderIds = favorites
    .map((f) => f.tenders?.id)
    .filter((id): id is string => Boolean(id));
  const sharedIdsResult = await listSharedFavoriteTenderIds(
    supabase,
    tenderIds,
  );
  const propias = favorites.filter((f) => f.kind === "propia");
  const subcontratas = favorites.filter((f) => f.kind === "subcontrata");

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
          <div className="space-y-10">
            {(
              [
                ["propia", propias],
                ["subcontrata", subcontratas],
              ] as const
            ).map(([kind, group]) => (
              <section key={kind} aria-labelledby={`fav-kind-${kind}`}>
                <h2
                  id={`fav-kind-${kind}`}
                  className="text-lg font-semibold tracking-tight text-foreground"
                >
                  {favoriteKindLongLabel(kind)}
                  <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
                    ({group.length})
                  </span>
                </h2>
                <div className="mt-3">
                  {group.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Ninguna aún.</p>
                  ) : (
                    <PaginatedFavoriteTenders
                      favorites={group}
                      from="favorites-tenders"
                      shareUserId={userId}
                      sharedTenderIds={sharedIdsResult.data}
                    />
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
