import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnProfile, listOwnFavorites } from "@/lib/queries";
import {
  FAVORITES_PREVIEW_LIMIT,
  FavoriteTenderList,
} from "../favorites-shared";

export const dynamic = "force-dynamic";

export default async function FavoriteTendersPage() {
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

  // Sin overflow no hay página de listado completo.
  if (!error && favorites.length <= FAVORITES_PREVIEW_LIMIT) {
    redirect("/favorites");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
      <p className="text-sm">
        <Link
          href="/favorites"
          className="font-medium text-link hover:underline"
        >
          ← Volver a la lista de favoritos
        </Link>
      </p>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
        Licitaciones favoritas
      </h1>

      {error ? (
        <p className="mt-6 text-sm text-destructive" role="alert">
          {error.message}
        </p>
      ) : (
        <div className="mt-8">
          <FavoriteTenderList favorites={favorites} />
        </div>
      )}
    </main>
  );
}
