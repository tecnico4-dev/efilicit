import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getOwnProfile,
  listOwnAlerts,
  listOwnSavedSearches,
} from "@/lib/queries";
import {
  formatCriteriaSummary,
  parseCriteria,
} from "@/lib/criteria-display";
import { AlertRowItem } from "./alert-row";
import { AlertsPanel } from "./alerts-panel";

export const dynamic = "force-dynamic";

function searchHrefFromCriteria(criteria: ReturnType<typeof parseCriteria>): string {
  const params = new URLSearchParams();
  if (criteria.keywords?.length) {
    params.set("q", criteria.keywords.join(" "));
  }
  if (criteria.cpv_codes?.[0]) {
    params.set("cpv", criteria.cpv_codes[0]);
  }
  if (criteria.estimated_value_min != null) {
    params.set("min", String(criteria.estimated_value_min));
  }
  if (criteria.estimated_value_max != null) {
    params.set("max", String(criteria.estimated_value_max));
  }
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}

export default async function AlertsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/alerts");
  }

  const profileResult = await getOwnProfile(supabase);
  if (!profileResult.data) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-destructive">
          No hay perfil en public.users:{" "}
          {profileResult.error?.message ?? "desconocido"}
        </p>
      </main>
    );
  }

  const digestFrequency =
    profileResult.data.digest_frequency === "weekly" ? "weekly" : "daily";

  const [alertsResult, searchesResult] = await Promise.all([
    listOwnAlerts(supabase),
    listOwnSavedSearches(supabase),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Alertas
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Recibe un digest con licitaciones que coincidan con tus criterios.
      </p>

      <AlertsPanel
        userId={profileResult.data.id}
        digestFrequency={digestFrequency}
      />

      <section className="mt-10">
        <h2 className="text-base font-medium text-foreground">Mis alertas</h2>
        {alertsResult.error ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {alertsResult.error.message}
          </p>
        ) : alertsResult.data.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Aún no tienes alertas. Crea una arriba o desde la búsqueda.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border border-t border-border">
            {alertsResult.data.map((a) => (
              <AlertRowItem key={a.id} alert={a} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-base font-medium text-foreground">
          Búsquedas guardadas
        </h2>
        {searchesResult.error ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {searchesResult.error.message}
          </p>
        ) : searchesResult.data.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Ninguna aún. Puedes guardar criterios desde Buscar.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border border-t border-border">
            {searchesResult.data.map((s) => {
              const criteria = parseCriteria(s.criteria);
              return (
                <li key={s.id} className="py-4 text-sm">
                  <p className="font-medium text-foreground">{s.name}</p>
                  <p className="mt-1 text-muted-foreground">
                    {formatCriteriaSummary(criteria)}
                  </p>
                  <Link
                    href={searchHrefFromCriteria(criteria)}
                    className="mt-2 inline-block text-sm font-medium text-link hover:underline"
                  >
                    Abrir en búsqueda
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
