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
      <main className="mx-auto max-w-2xl bg-white px-6 py-10">
        <p className="text-red-800">
          No hay perfil en public.users: {profileResult.error?.message ?? "desconocido"}
        </p>
      </main>
    );
  }

  const [alertsResult, searchesResult] = await Promise.all([
    listOwnAlerts(supabase),
    listOwnSavedSearches(supabase),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col bg-white px-6 py-10">
      <p className="text-sm text-zinc-500">
        <Link href="/" className="hover:underline">
          EfiLicit
        </Link>
        <span className="mx-2">/</span>
        Alertas
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
        Alertas y búsquedas guardadas
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        Solo ves y creas las tuyas (RLS). Usuario:{" "}
        <span className="font-mono">{user.email}</span>
      </p>

      <AlertsPanel userId={profileResult.data.id} />

      <section className="mt-10">
        <h2 className="text-base font-medium text-zinc-900">Mis alertas</h2>
        {alertsResult.error ? (
          <p className="mt-2 text-sm text-red-800">{alertsResult.error.message}</p>
        ) : alertsResult.data.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">Ninguna aún.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200 border-t border-zinc-200">
            {alertsResult.data.map((a) => (
              <li key={a.id} className="py-3 text-sm">
                <p className="font-medium text-zinc-900">{a.name}</p>
                <p className="font-mono text-xs text-zinc-500">{a.id}</p>
                <p className="text-zinc-600">
                  {a.frequency} · {a.is_active ? "activa" : "inactiva"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-base font-medium text-zinc-900">Mis búsquedas guardadas</h2>
        {searchesResult.error ? (
          <p className="mt-2 text-sm text-red-800">{searchesResult.error.message}</p>
        ) : searchesResult.data.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">Ninguna aún.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200 border-t border-zinc-200">
            {searchesResult.data.map((s) => (
              <li key={s.id} className="py-3 text-sm">
                <p className="font-medium text-zinc-900">{s.name}</p>
                <p className="font-mono text-xs text-zinc-500">{s.id}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
