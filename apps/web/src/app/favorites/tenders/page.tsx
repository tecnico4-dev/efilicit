import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnProfile, listOwnFavorites } from "@/lib/queries";
import { FavoriteTenderList } from "../favorites-shared";

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

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/favorites/tenders");
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

  const { data: favorites, error } = await listOwnFavorites(supabase);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
      <p className="text-sm">
        <Link href={back.href} className="font-medium text-link hover:underline">
          {back.label}
        </Link>
      </p>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
        Licitaciones favoritas
      </h1>

      {error ? (
        <p className="mt-6 text-sm text-destructive" role="alert">
          {error.message}
        </p>
      ) : favorites.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Aún no tienes licitaciones en favoritos.
        </p>
      ) : (
        <div className="mt-8">
          <FavoriteTenderList
            favorites={favorites}
            from="favorites-tenders"
          />
        </div>
      )}
    </main>
  );
}
