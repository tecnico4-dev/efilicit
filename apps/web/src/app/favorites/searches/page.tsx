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
import {
  listOwnSavedSearches,
  type DigestFrequency,
} from "@/lib/queries";
import { EmptySavedSearchesHint } from "../empty-hints";
import { PaginatedSavedSearches } from "../paginated-saved-searches";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function SavedSearchesPage({
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

  const digestFrequency: DigestFrequency =
    profile.data.digest_frequency === "semanal" ? "semanal" : "diaria";

  const { data: searches, error } = await listOwnSavedSearches(supabase);

  return (
    <main className={PAGE_MAIN_CLASS}>
      <p className="text-sm">
        <Link href={back.href} className="font-medium text-link hover:underline">
          {back.label}
        </Link>
      </p>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
        Búsquedas guardadas
      </h1>

      <div className={PAGE_TITLE_RULE}>
        {error ? (
          <ErrorState>{error.message}</ErrorState>
        ) : searches.length === 0 ? (
          <EmptyState>
            <EmptySavedSearchesHint />
          </EmptyState>
        ) : (
          <PaginatedSavedSearches
            searches={searches}
            userId={profile.data.id}
            digestFrequency={digestFrequency}
            searchFrom="favorites-searches"
          />
        )}
      </div>
    </main>
  );
}
