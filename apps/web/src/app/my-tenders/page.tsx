import Link from "next/link";
import {
  getSessionProfile,
  getSupabaseServerClient,
} from "@/lib/auth/session";
import {
  BID_STAGE_LABELS,
  listBidCaseHistoryYears,
  listBidCases,
  type BidStage,
} from "@/lib/queries";
import { formatCountdown } from "@/lib/bid-countdown";
import { formatDateMadrid } from "@/lib/datetime";
import {
  PAGE_MAIN_CLASS,
  PAGE_TITLE_RULE,
} from "@/components/shell/page-width";
import { ErrorState } from "@/components/ui/state-message";
import { CaseStageBadge } from "@/components/my-tenders/case-stage-badge";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function formatMoneySafe(
  value: number | null | undefined,
  currency: string | undefined,
): string {
  if (value == null) return "—";
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} ${currency ?? ""}`;
  }
}

export default async function MyTendersPage({ searchParams }: PageProps) {
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
    listBidCases(supabase, {
      scope: tab,
      year: tab === "historic" && Number.isFinite(year) ? year : undefined,
    }),
    listBidCaseHistoryYears(supabase),
  ]);

  const cases = casesResult.data;
  const years = yearsResult.data;

  return (
    <main className={PAGE_MAIN_CLASS}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Mis licitaciones
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Pipeline compartido de Eficen: preparación, presentación e
            histórico. Añade una licitación desde su ficha.
          </p>
        </div>
        <Link
          href="/search"
          className="text-sm font-medium text-link hover:underline"
        >
          Ir a búsqueda →
        </Link>
      </div>

      <div className={PAGE_TITLE_RULE}>
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
          <TabLink href="/my-tenders" active={tab === "active"}>
            Activas
          </TabLink>
          <TabLink
            href="/my-tenders?tab=historic"
            active={tab === "historic"}
          >
            Histórico
          </TabLink>
          {tab === "historic" && years.length > 0 ? (
            <div className="ml-auto flex flex-wrap gap-1.5">
              <YearChip href="/my-tenders?tab=historic" active={!year}>
                Todos
              </YearChip>
              {years.map((y) => (
                <YearChip
                  key={y}
                  href={`/my-tenders?tab=historic&year=${y}`}
                  active={year === y}
                >
                  {y}
                </YearChip>
              ))}
            </div>
          ) : null}
        </div>

        {casesResult.error ? (
          <ErrorState className="mt-6">
            {casesResult.error.message}
          </ErrorState>
        ) : cases.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-border bg-surface/60 px-6 py-10 text-center">
            <p className="text-sm font-medium text-foreground">
              {tab === "active"
                ? "Todavía no hay expedientes activos"
                : "Sin histórico en este filtro"}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Abre una licitación en el buscador y pulsa «Añadir a Mis
              licitaciones». Tendrás responsable, checklist con cuenta atrás,
              novedades y documentación reutilizable.
            </p>
            <Link
              href="/search"
              className="mt-4 inline-flex text-sm font-medium text-link hover:underline"
            >
              Buscar licitaciones
            </Link>
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-surface">
            {cases.map((item) => {
              const due =
                item.next_due_at ?? item.tenders?.deadline_at ?? null;
              const cd = formatCountdown(
                item.stage === "interes" ||
                  item.stage === "preparacion" ||
                  item.stage === "presentada"
                  ? due
                  : null,
              );
              return (
                <li key={item.id}>
                  <Link
                    href={`/my-tenders/${item.id}`}
                    className="block px-4 py-4 transition-colors hover:bg-muted/50 sm:px-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">
                          {item.tenders?.title ?? "Licitación eliminada"}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <CaseStageBadge stage={item.stage} />
                          {item.owner_name ? (
                            <span className="text-xs text-muted-foreground">
                              Resp. {item.owner_name}
                            </span>
                          ) : null}
                          {item.preparation_started_on ? (
                            <span className="text-xs text-muted-foreground">
                              Prep.{" "}
                              {formatDateMadrid(item.preparation_started_on)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>
                          {formatMoneySafe(
                            item.tenders?.estimated_value,
                            item.tenders?.currency,
                          )}
                        </p>
                        {item.checklist_total > 0 ? (
                          <p className="mt-1">
                            Checklist {item.checklist_done}/
                            {item.checklist_total}
                          </p>
                        ) : null}
                        {cd.tone !== "none" ? (
                          <p
                            className={cn(
                              "mt-1 font-medium",
                              cd.tone === "overdue" && "text-destructive",
                              cd.tone === "soon" && "text-amber-700",
                            )}
                          >
                            {cd.label}
                          </p>
                        ) : null}
                        {tab === "historic" ? (
                          <p className="mt-1">
                            {item.stage in BID_STAGE_LABELS
                              ? BID_STAGE_LABELS[item.stage as BidStage]
                              : item.stage}
                            {item.outcome_on || item.presented_on
                              ? ` · ${formatDateMadrid(
                                  item.outcome_on ?? item.presented_on,
                                )}`
                              : null}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
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
