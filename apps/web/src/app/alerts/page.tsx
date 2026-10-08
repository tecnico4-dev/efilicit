import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getOwnProfile,
  listOwnAlerts,
  listOwnSavedSearches,
} from "@/lib/queries";
import { AlertsPanel } from "./alerts-panel";

export const dynamic = "force-dynamic";

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
      <main className="mx-auto max-w-2xl bg-background px-6 py-10">
        <p className="text-red-800">
          No hay perfil en public.users: {profileResult.error?.message ?? "desconocido"}
        </p>
      </main>
    );
  }

  const digestFrequency =
    profileResult.data.digest_frequency === "weekly" ? "weekly" : "daily";
  const digestLabel = digestFrequency === "weekly" ? "semanal" : "diario";

  const [alertsResult, searchesResult] = await Promise.all([
    listOwnAlerts(supabase),
    listOwnSavedSearches(supabase),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col bg-background px-6 py-10">
      <p className="text-sm text-muted-foreground">
        <Link href="/" className="hover:underline">
          EfiLicit
        </Link>
        <span className="mx-2">/</span>
        Alertas
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
        Alertas y búsquedas guardadas
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Solo ves y creas las tuyas (RLS). Usuario:{" "}
        <span className="font-mono">{user.email}</span>
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Digest de email: <strong>{digestLabel}</strong> (preferencia de{" "}
        <Link href="/account" className="underline">
          cuenta
        </Link>
        ).
      </p>

      <AlertsPanel userId={profileResult.data.id} digestFrequency={digestFrequency} />

      <section className="mt-10">
        <h2 className="text-base font-medium text-foreground">Mis alertas</h2>
        {alertsResult.error ? (
          <p className="mt-2 text-sm text-red-800">{alertsResult.error.message}</p>
        ) : alertsResult.data.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Ninguna aún.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border border-t border-border">
            {alertsResult.data.map((a) => (
              <li key={a.id} className="py-3 text-sm">
                <p className="font-medium text-foreground">{a.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{a.id}</p>
                <p className="text-muted-foreground">
                  {a.is_active ? "activa" : "inactiva"} · digest cuenta: {digestLabel}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-base font-medium text-foreground">Mis búsquedas guardadas</h2>
        {searchesResult.error ? (
          <p className="mt-2 text-sm text-red-800">{searchesResult.error.message}</p>
        ) : searchesResult.data.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Ninguna aún.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border border-t border-border">
            {searchesResult.data.map((s) => (
              <li key={s.id} className="py-3 text-sm">
                <p className="font-medium text-foreground">{s.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{s.id}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
