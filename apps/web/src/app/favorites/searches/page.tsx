import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getOwnProfile,
  listOwnSavedSearches,
  type DigestFrequency,
} from "@/lib/queries";
import { SavedSearchList } from "../favorites-shared";

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
  const fromNav = first(params.from) === "nav";
  const backLabel = fromNav
    ? "← Ir a la lista de favoritos"
    : "← Volver a la lista de favoritos";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/favorites/searches");
  }

  const profile = await getOwnProfile(supabase);
  if (!profile.data) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-destructive">
          No hay perfil en public.users:{" "}
          {profile.error?.message ?? "desconocido"}
        </p>
      </main>
    );
  }

  const digestFrequency: DigestFrequency =
    profile.data.digest_frequency === "weekly" ? "weekly" : "daily";

  const { data: searches, error } = await listOwnSavedSearches(supabase);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
      <p className="text-sm">
        <Link
          href="/favorites"
          className="font-medium text-link hover:underline"
        >
          {backLabel}
        </Link>
      </p>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
        Búsquedas guardadas
      </h1>

      {error ? (
        <p className="mt-6 text-sm text-destructive" role="alert">
          {error.message}
        </p>
      ) : searches.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Ninguna búsqueda guardada aún.
        </p>
      ) : (
        <div className="mt-8">
          <SavedSearchList
            searches={searches}
            userId={profile.data.id}
            digestFrequency={digestFrequency}
            searchFrom="favorites-searches"
          />
        </div>
      )}
    </main>
  );
}
