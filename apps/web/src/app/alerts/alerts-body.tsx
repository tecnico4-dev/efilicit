import { EmptyState, ErrorState } from "@/components/ui/state-message";
import {
  PAGE_TITLE_RULE,
} from "@/components/shell/page-width";
import {
  getSessionProfile,
  getSupabaseServerClient,
} from "@/lib/auth/session";
import {
  listMunicipalityNamesByCodes,
  listOwnAlertIdsWithQueueItems,
  listOwnAlerts,
  listSearchFilterOptions,
} from "@/lib/queries";
import { parseCriteria } from "@/lib/criteria-display";
import type { CriteriaFilterOptionsProp } from "@/components/criteria/criteria-filters";
import { AlertRowItem } from "./alert-row";
import { AlertsPanel } from "./alerts-panel";
import { DigestFrequencyControl } from "./digest-frequency-control";

/**
 * Cabecera (título + Crear alerta) + Mis alertas.
 * Pensado para `<Suspense>`: el loading/fallback muestra el marco.
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

  const alertMunCodes = (alertsResult.data ?? []).flatMap(
    (a) =>
      parseCriteria(a.criteria).geography?.municipality_codes ?? [],
  );
  const municipalityNames = await listMunicipalityNamesByCodes(
    supabase,
    alertMunCodes,
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Alertas
        </h1>
        <AlertsPanel
          userId={profileResult.data.id}
          digestFrequency={digestFrequency}
          filterOptions={filterOptions}
        />
      </div>

      <div className={PAGE_TITLE_RULE}>
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-medium text-foreground">
              Mis alertas
            </h2>
            <DigestFrequencyControl
              userId={profileResult.data.id}
              initialFrequency={digestFrequency}
            />
          </div>
          {alertsResult.error ? (
            <ErrorState className="mt-3">
              {alertsResult.error.message}
            </ErrorState>
          ) : alertsResult.data.length === 0 ? (
            <EmptyState className="mt-3">
              Aún no tienes alertas. Usa «Crear alerta» para añadir una.
            </EmptyState>
          ) : (
            <ul className="mt-3 divide-y divide-border border-t border-border">
              {alertsResult.data.map((a) => (
                <AlertRowItem
                  key={a.id}
                  alert={a}
                  filterOptions={filterOptions}
                  hasRelatedTenders={alertIdsWithQueue.has(a.id)}
                  municipalityNames={municipalityNames}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
