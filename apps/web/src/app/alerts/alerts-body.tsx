import { EmptyState, ErrorState } from "@/components/ui/state-message";
import {
  getSessionProfile,
  getSupabaseServerClient,
} from "@/lib/auth/session";
import {
  listOwnAlertIdsWithQueueItems,
  listOwnAlerts,
  listSearchFilterOptions,
} from "@/lib/queries";
import type { CriteriaFilterOptionsProp } from "@/components/criteria/criteria-filters";
import { AlertRowItem } from "./alert-row";
import { AlertsPanel } from "./alerts-panel";
import { DigestFrequencyControl } from "./digest-frequency-control";

/**
 * Perfil + lista de alertas. Pensado para `<Suspense>`: el `<h1>` de la
 * página pinta antes de este bloque.
 */
export async function AlertsBody() {
  let supabase;
  try {
    supabase = await getSupabaseServerClient();
  } catch {
    return (
      <ErrorState className="mt-8">
        No se pudo conectar con la base de datos.
      </ErrorState>
    );
  }

  const [profileResult, alertsResult, filterListed] = await Promise.all([
    getSessionProfile(),
    listOwnAlerts(supabase),
    listSearchFilterOptions(supabase),
  ]);

  if (!profileResult.data) {
    return (
      <ErrorState className="mt-8">
        No hay perfil en public.users:{" "}
        {profileResult.error?.message ?? "desconocido"}
      </ErrorState>
    );
  }

  const digestFrequency =
    profileResult.data.digest_frequency === "semanal" ? "semanal" : "diaria";

  const queueAlertIdsResult = await listOwnAlertIdsWithQueueItems(supabase, {
    userId: profileResult.data.id,
  });
  const alertIdsWithQueue = queueAlertIdsResult.data;

  const filterOptions: CriteriaFilterOptionsProp = filterListed.error
    ? {
        statuses: [],
        procedureTypes: [],
        contractTypes: [],
        ccaaCodesWithTenders: [],
      }
    : {
        statuses: filterListed.data.statuses,
        procedureTypes: filterListed.data.procedureTypes,
        contractTypes: filterListed.data.contractTypes,
        ccaaCodesWithTenders: [...filterListed.data.ccaaCodesWithTenders],
      };

  return (
    <>
      <AlertsPanel
        userId={profileResult.data.id}
        digestFrequency={digestFrequency}
        filterOptions={filterOptions}
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
              <AlertRowItem
                key={a.id}
                alert={a}
                filterOptions={filterOptions}
                hasRelatedTenders={alertIdsWithQueue.has(a.id)}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
