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
  listSharedFavoriteOwners,
} from "@/lib/queries";
import { EmptyFavoritesTendersHint } from "../empty-hints";
import { FavoriteKindTabs } from "../favorite-kind-tabs";
import { PaginatedFavoriteTenders } from "../paginated-favorite-tenders";

export const dynamic = "force-dynamic";

function emptyKindPanel() {
  return (
    <p className="rounded-lg rounded-tl-none border border-border px-4 py-8 text-center text-sm text-muted-foreground">
      Ninguna aún.
    </p>
  );
}

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
  const sharedOwnersResult = await listSharedFavoriteOwners(
    supabase,
    tenderIds,
  );
  const sharedOwners = Object.fromEntries(sharedOwnersResult.data);
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
          <FavoriteKindTabs
            ariaLabel="Tipo de favorito"
            todasCount={favorites.length}
            propiasCount={propias.length}
            subcontratasCount={subcontratas.length}
            todas={
              <PaginatedFavoriteTenders
                favorites={favorites}
                from="favorites-tenders"
                shareUserId={userId}
                sharedOwners={sharedOwners}
              />
            }
            propias={
              propias.length === 0 ? (
                emptyKindPanel()
              ) : (
                <PaginatedFavoriteTenders
                  favorites={propias}
                  from="favorites-tenders"
                  shareUserId={userId}
                  sharedOwners={sharedOwners}
                />
              )
            }
            subcontratas={
              subcontratas.length === 0 ? (
                emptyKindPanel()
              ) : (
                <PaginatedFavoriteTenders
                  favorites={subcontratas}
                  from="favorites-tenders"
                  shareUserId={userId}
                  sharedOwners={sharedOwners}
                />
              )
            }
          />
        )}
      </div>
    </main>
  );
}
