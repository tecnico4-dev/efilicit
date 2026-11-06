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
  PAGE_MAIN_CLASS,
  PAGE_TITLE_RULE,
} from "@/components/shell/page-width";
import { ErrorState } from "@/components/ui/state-message";
import { PipelineBoard } from "@/components/mis-licitaciones/pipeline-board";
import { cn } from "@/lib/cn";

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
      <main className={PAGE_MAIN_CLASS}>
        <ErrorState>
          No hay perfil en public.users:{" "}
          {profile.error?.message ?? "desconocido"}
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

  return (
    <main className={PAGE_MAIN_CLASS}>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Mis licitaciones
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Espacio de preparación de oferta · pipeline compartido Eficen
      </p>

      <div className={PAGE_TITLE_RULE}>
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
          <TabLink href="/mis-licitaciones" active={tab === "active"}>
            Activas
          </TabLink>
          <TabLink
            href="/mis-licitaciones?tab=historic"
            active={tab === "historic"}
          >
            Histórico
          </TabLink>
          {tab === "historic" && years.length > 0 ? (
            <div className="ml-auto flex flex-wrap gap-1.5">
              <YearChip href="/mis-licitaciones?tab=historic" active={!year}>
                Todos
              </YearChip>
              {years.map((y) => (
                <YearChip
                  key={y}
                  href={`/mis-licitaciones?tab=historic&year=${y}`}
                  active={year === y}
                >
                  {y}
                </YearChip>
              ))}
            </div>
          ) : null}
        </div>

        {casesResult.error ? (
          <ErrorState className="mt-6">{casesResult.error.message}</ErrorState>
        ) : cases.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-border bg-surface/60 px-6 py-10 text-center">
            <p className="text-sm font-medium text-foreground">
              {tab === "active"
                ? "Todavía no hay expedientes activos"
                : "Sin histórico en este filtro"}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {tab === "active"
                ? "Abre una licitación en el buscador y pulsa «Añadir a Mis licitaciones»."
                : "Cuando un expediente pase a adjudicada, no adjudicada, descartada, subcontrata o desierta aparecerá aquí."}
            </p>
            {tab === "active" ? (
              <Link
                href="/search"
                className="mt-4 inline-flex text-sm font-medium text-link hover:underline"
              >
                Buscar licitaciones
              </Link>
            ) : null}
          </div>
        ) : (
          <PipelineBoard scope={tab} cases={cases} />
        )}
      </div>
    </main>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function YearChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium",
        active
          ? "border-primary/40 bg-primary/10 text-link"
          : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}
