import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnProfile, listOwnAlerts } from "@/lib/queries";
import { AlertRowItem } from "./alert-row";
import { AlertsPanel } from "./alerts-panel";
import { DigestFrequencyControl } from "./digest-frequency-control";

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

  const alertsResult = await listOwnAlerts(supabase);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Alertas
      </h1>

      <AlertsPanel
        userId={profileResult.data.id}
        digestFrequency={digestFrequency}
      />

      <section className="mt-10">
        <h2 className="text-base font-medium text-foreground">Mis alertas</h2>
        <DigestFrequencyControl
          userId={profileResult.data.id}
          initialFrequency={digestFrequency}
        />
        {alertsResult.error ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {alertsResult.error.message}
          </p>
        ) : alertsResult.data.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Aún no tienes alertas. Crea una arriba.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border border-t border-border">
            {alertsResult.data.map((a) => (
              <AlertRowItem key={a.id} alert={a} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
