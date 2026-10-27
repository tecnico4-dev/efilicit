import Link from "next/link";
import {
  PAGE_MAIN_CLASS,
  PAGE_TITLE_RULE,
} from "@/components/shell/page-width";
import { EmptyState, ErrorState } from "@/components/ui/state-message";
import {
  getSessionProfile,
  getSupabaseServerClient,
} from "@/lib/auth/session";
import { listOwnFavorites } from "@/lib/queries";
import { EmptyFavoritesTendersHint } from "../empty-hints";
import { PaginatedFavoriteTenders } from "../paginated-favorite-tenders";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function FavoriteTendersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const from = first(params.from);
  const back =
    from === "home"
      ? { href: "/", label: "← Volver al Inicio" }
      : from === "nav"
        ? { href: "/favorites", label: "← Ir a la lista de favoritos" }
        : { href: "/favorites", label: "← Volver a la lista de favoritos" };

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

  return (
    <main className={PAGE_MAIN_CLASS}>
      <p className="text-sm">
        <Link href={back.href} className="font-medium text-link hover:underline">
          {back.label}
        </Link>
      </p>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
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
          />
        )}
      </div>
    </main>
  );
}
