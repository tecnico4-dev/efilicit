import { redirect } from "next/navigation";
import { PAGE_MAIN_CLASS } from "@/components/shell/page-width";
import { EmptyState, ErrorState } from "@/components/ui/state-message";
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
      <main className={PAGE_MAIN_CLASS}>
        <ErrorState>
          No hay perfil en public.users:{" "}
          {profileResult.error?.message ?? "desconocido"}
        </ErrorState>
      </main>
    );
  }

  const digestFrequency =
    profileResult.data.digest_frequency === "semanal" ? "semanal" : "diaria";

  const alertsResult = await listOwnAlerts(supabase);

  return (
    <main className={PAGE_MAIN_CLASS}>
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
          <ErrorState className="mt-2">{alertsResult.error.message}</ErrorState>
        ) : alertsResult.data.length === 0 ? (
          <EmptyState className="mt-2">
            Aún no tienes alertas. Crea una arriba.
          </EmptyState>
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
