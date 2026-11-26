import Link from "next/link";
import {
  getSessionProfile,
  getSupabaseServerClient,
} from "@/lib/auth/session";
import {
  listOfferCaseHistoryYears,
  listOfferCases,
} from "@/lib/queries";
import {
  PAGE_MAIN_FAVORITES_CLASS,
  PAGE_TITLE_RULE,
} from "@/components/shell/page-width";
import { ErrorState } from "@/components/ui/state-message";
import { MisLicitacionesSection } from "@/components/mis-licitaciones/mis-licitaciones-section";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function MisLicitacionesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tab = first(params.tab) === "historic" ? "historic" : "active";
  const yearRaw = first(params.year).trim();
  const year = yearRaw ? Number.parseInt(yearRaw, 10) : undefined;

  const supabase = await getSupabaseServerClient();
  const profile = await getSessionProfile();
  if (!profile.data) {
    return (
      <main className={PAGE_MAIN_FAVORITES_CLASS}>
        <ErrorState>
          No se pudo cargar tu cuenta. Cierra sesión e inicia de nuevo, o
          contacta con soporte.
        </ErrorState>
      </main>
    );
  }

  const [casesResult, yearsResult] = await Promise.all([
    listOfferCases(supabase, {
      scope: tab,
      year: tab === "historic" && Number.isFinite(year) ? year : undefined,
    }),
    listOfferCaseHistoryYears(supabase),
  ]);

  const cases = casesResult.data;
  const years = yearsResult.data;

  const empty = (
    <div className="rounded-xl rounded-tl-none border border-dashed border-border bg-surface/60 px-6 py-10 text-center">
      <p className="text-sm font-medium text-foreground">
        {tab === "active" ? "Todavía no hay expedientes activos" : "Sin histórico."}
      </p>
      {tab === "active" ? (
        <>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Abre una licitación en el buscador y pulsa «Añadir a Mis licitaciones».
          </p>
          <Link
            href="/search"
            className="mt-4 inline-flex text-sm font-medium text-link hover:underline"
          >
            Buscar licitaciones
          </Link>
        </>
      ) : null}
    </div>
  );

  return (
    <main className={PAGE_MAIN_FAVORITES_CLASS}>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Mis licitaciones
      </h1>

      <div className={PAGE_TITLE_RULE}>
        {casesResult.error ? (
          <ErrorState>
            No se pudo cargar Mis licitaciones. Inténtalo de nuevo.
          </ErrorState>
        ) : (
          <MisLicitacionesSection
            key={tab}
            scope={tab}
            cases={cases}
            years={years}
            year={
              tab === "historic" && Number.isFinite(year) ? year : undefined
            }
            empty={empty}
          />
        )}
      </div>
    </main>
  );
}
