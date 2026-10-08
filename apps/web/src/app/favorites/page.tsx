import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnProfile, listOwnFavorites } from "@/lib/queries";

export const dynamic = "force-dynamic";

function formatMoney(value: number | null, currency: string): string {
  if (value == null) return "—";
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

export default async function FavoritesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/favorites");
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
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Favoritos
      </h1>

      {error ? (
        <p className="mt-6 text-sm text-destructive" role="alert">
          {error.message}
        </p>
      ) : favorites.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Aún no tienes licitaciones en favoritos. Ábrelas desde la búsqueda y
          pulsa «Guardar en favoritos».
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-border border-t border-border">
          {favorites.map((fav) => {
            const tender = fav.tenders;
            if (!tender) {
              return (
                <li key={fav.id} className="py-4 text-sm text-muted-foreground">
                  Licitación no disponible
                </li>
              );
            }
            return (
              <li key={fav.id} className="py-4">
                <Link
                  href={`/tenders/${tender.id}`}
                  className="text-base font-medium text-foreground hover:text-link hover:underline"
                >
                  {tender.title}
                </Link>
                <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <div>
                    <dt className="inline">Importe · </dt>
                    <dd className="inline">
                      {formatMoney(tender.estimated_value, tender.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline">CPV · </dt>
                    <dd className="inline font-mono">{tender.cpv_code ?? "—"}</dd>
                  </div>
                  {tender.status ? (
                    <div>
                      <dt className="inline">Estado · </dt>
                      <dd className="inline">{tender.status}</dd>
                    </div>
                  ) : null}
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
