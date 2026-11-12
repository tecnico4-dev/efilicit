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
          <PaginatedSharedFavorites items={items} />
        )}
      </div>
    </main>
  );
}
