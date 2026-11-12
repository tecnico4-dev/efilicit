import {
  PAGE_MAIN_CLASS,
  PAGE_TITLE_RULE,
} from "@/components/shell/page-width";
import { EmptyState, ErrorState } from "@/components/ui/state-message";
import {
  getSessionProfile,
  getSupabaseServerClient,
} from "@/lib/auth/session";
import { listSharedFavorites } from "@/lib/queries";
import { EmptySharedFavoritesHint } from "../empty-hints";
import { FavoriteKindTabs } from "../favorite-kind-tabs";
import { PaginatedSharedFavorites } from "../paginated-shared-favorites";

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

  const { data: items, error } = await listSharedFavorites(supabase);
  const propias = items.filter((i) => i.kind === "propia");
  const subcontratas = items.filter((i) => i.kind === "subcontrata");

  return (
    <main className={PAGE_MAIN_CLASS}>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Común
      </h1>

      <div className={PAGE_TITLE_RULE}>
        {error ? (
          <ErrorState>{error.message}</ErrorState>
        ) : items.length === 0 ? (
          <EmptyState>
            <EmptySharedFavoritesHint />
          </EmptyState>
        ) : (
          <FavoriteKindTabs
            ariaLabel="Tipo en Común"
            propiasCount={propias.length}
            subcontratasCount={subcontratas.length}
            propias={
              propias.length === 0 ? (
                <p className="rounded-lg rounded-tl-none border border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  Ninguna aún.
                </p>
              ) : (
                <PaginatedSharedFavorites items={propias} />
              )
            }
            subcontratas={
              subcontratas.length === 0 ? (
                <p className="rounded-lg rounded-tl-none border border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  Ninguna aún.
                </p>
              ) : (
                <PaginatedSharedFavorites items={subcontratas} />
              )
            }
          />
        )}
      </div>
    </main>
  );
}
