import type { CriteriaFilterOptionsProp } from "@/components/criteria/criteria-filters";
import {
  PAGE_MAIN_FAVORITES_CLASS,
  PAGE_TITLE_RULE,
} from "@/components/shell/page-width";
import { ErrorState } from "@/components/ui/state-message";
import {
  getSessionProfile,
  getSupabaseServerClient,
} from "@/lib/auth/session";
import { formatDateTimeMadrid } from "@/lib/datetime";
import {
  listOwnRecommendations,
  listSearchFilterOptions,
} from "@/lib/queries";
import { RecommendationsSection } from "./recommendations-section";

export const dynamic = "force-dynamic";

export default async function RecommendationsPage() {
  let supabase;
  try {
    supabase = await getSupabaseServerClient();
  } catch {
    return (
      <main className={PAGE_MAIN_FAVORITES_CLASS}>
        <ErrorState>No se pudo conectar con la base de datos.</ErrorState>
      </main>
    );
  }

  const profile = await getSessionProfile();
  if (!profile.data) {
    return (
      <main className={PAGE_MAIN_FAVORITES_CLASS}>
        <ErrorState>Sesión sin perfil de aplicación.</ErrorState>
      </main>
    );
  }

  const userId = profile.data.id;
  const [recsResult, filterListed] = await Promise.all([
    listOwnRecommendations(supabase, {
      userId,
      limitPerKind: null,
    }),
    listSearchFilterOptions(supabase),
  ]);
  const { data, error } = recsResult;
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
    <main className={PAGE_MAIN_FAVORITES_CLASS}>
      {/* Misma geometría H1 + PAGE_TITLE_RULE que Notificaciones; «Actualizado» flota en el hueco. */}
      <div className="relative">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Recomendaciones para ti
        </h1>
        {data.computedAt ? (
          <p className="pointer-events-none absolute right-0 top-[calc(100%+2rem-0.5rem)] -translate-y-full text-xs text-muted-foreground">
            Actualizado el {formatDateTimeMadrid(data.computedAt)}
          </p>
        ) : null}
      </div>

      <div className={PAGE_TITLE_RULE}>
        {error ? (
          <ErrorState>
            No se pudieron cargar recomendaciones: {error.message}
          </ErrorState>
        ) : (
          <RecommendationsSection
            userId={userId}
            propia={data.propia}
            subcontrata={data.subcontrata}
            filterOptions={filterOptions}
            hasComputedAt={Boolean(data.computedAt)}
          />
        )}
      </div>
    </main>
  );
}
