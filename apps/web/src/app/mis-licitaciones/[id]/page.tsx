import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getSessionProfile,
  getSupabaseServerClient,
} from "@/lib/auth/session";
import {
  BID_STAGE_LABELS,
  HISTORIC_BID_STAGES,
  getBidCaseById,
  getTenderById,
  listBidDocuments,
  type BidStage,
} from "@/lib/queries";
import { formatCountdown } from "@/lib/bid-countdown";
import { formatDateMadrid, formatDateTimeMadrid } from "@/lib/datetime";
import { formatTenderStatus } from "@/lib/tender-labels";
import { PAGE_MAIN_CLASS } from "@/components/shell/page-width";
import { ErrorState } from "@/components/ui/state-message";
import { CaseStageBadge } from "@/components/my-tenders/case-stage-badge";
import { TenderFichaModalButton } from "@/components/my-tenders/tender-ficha-modal";
import {
  CaseMetaForm,
  ChecklistPanel,
  DocumentsPanel,
  UpdatesPanel,
} from "@/components/my-tenders/case-detail-panels";
import { DetailTabs } from "@/components/mis-licitaciones/detail-tabs";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

function formatMoney(value: number | null, currency: string): string {
  if (value == null) return "—";
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

function isHistoric(stage: string): boolean {
  return (HISTORIC_BID_STAGES as readonly string[]).includes(stage);
}

export default async function MisLicitacionDetailPage({ params }: PageProps) {
  const { id } = await params;
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

  const [{ data: bidCase, error }, libraryResult] = await Promise.all([
    getBidCaseById(supabase, id),
    listBidDocuments(supabase),
  ]);

  if (error) {
    return (
      <main className={PAGE_MAIN_CLASS}>
        <ErrorState>{error.message}</ErrorState>
      </main>
    );
  }
  if (!bidCase) notFound();

  const tenderSummary = bidCase.tenders;
  const tenderDetailResult = tenderSummary
    ? await getTenderById(supabase, tenderSummary.id)
    : { data: null, error: null };
  const tenderFull = tenderDetailResult.data;

  const pendingChecklist = bidCase.checklist.filter((c) => !c.done_at);
  const due =
    pendingChecklist.find((c) => c.due_at)?.due_at ??
    tenderSummary?.deadline_at ??
    null;
  const cd = formatCountdown(isHistoric(bidCase.stage) ? null : due);
  const total = bidCase.checklist.length;
  const done = bidCase.checklist.filter((c) => c.done_at).length;
  const prepPct = total > 0 ? Math.round((done / total) * 100) : null;

  const missing = [
    ...pendingChecklist
      .filter((c) => c.due_at && new Date(c.due_at).getTime() < Date.now())
      .map((c) => ({
        tone: "bad" as const,
        title: c.title,
        detail: "Vencido",
      })),
    ...pendingChecklist
      .filter((c) => !c.due_at || new Date(c.due_at).getTime() >= Date.now())
      .slice(0, 5)
      .map((c) => ({
        tone: "warn" as const,
        title: c.title,
        detail: c.due_at
          ? `Vence ${formatDateMadrid(c.due_at)}`
          : "Pendiente",
      })),
  ];

  const stageLabel =
    bidCase.stage in BID_STAGE_LABELS
      ? BID_STAGE_LABELS[bidCase.stage as BidStage]
      : bidCase.stage;

  return (
    <main className={PAGE_MAIN_CLASS}>
      <Link
        href="/mis-licitaciones"
        className="mb-4 inline-flex text-sm font-medium text-link hover:underline"
      >
        ← Volver al pipeline
      </Link>

      <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CaseStageBadge stage={bidCase.stage} />
              {cd.tone !== "none" ? (
                <span
                  className={cn(
                    "text-xs font-medium",
                    cd.tone === "overdue" && "text-destructive",
                    cd.tone === "soon" && "text-amber-700",
                    cd.tone === "ok" && "text-muted-foreground",
                  )}
                >
                  {cd.label}
                </span>
              ) : null}
            </div>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {tenderSummary?.title ?? "Licitación eliminada"}
            </h1>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {tenderSummary ? (
                <span>
                  {formatMoney(
                    tenderSummary.estimated_value,
                    tenderSummary.currency,
                  )}
                </span>
              ) : null}
              {tenderSummary?.status ? (
                <span>{formatTenderStatus(tenderSummary.status)}</span>
              ) : null}
              {tenderSummary?.deadline_at ? (
                <span>
                  Plazo {formatDateTimeMadrid(tenderSummary.deadline_at)}
                </span>
              ) : null}
              {bidCase.owner_name ? (
                <span>Resp. {bidCase.owner_name}</span>
              ) : null}
              {bidCase.outcome_on ? (
                <span>Outcome {formatDateMadrid(bidCase.outcome_on)}</span>
              ) : null}
            </div>
          </div>
          {tenderFull ? <TenderFichaModalButton tender={tenderFull} /> : null}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Cumplimiento / checklist"
            value={
              total > 0 ? `${done}/${total}` : "Sin requisitos aún"
            }
          />
          <Kpi
            label="Preparación"
            value={prepPct != null ? `${prepPct}%` : "—"}
            bar={prepPct}
          />
          <Kpi
            label="Riesgo plazo"
            value={
              isHistoric(bidCase.stage)
                ? "Histórico"
                : cd.tone === "overdue"
                  ? "🔴 Crítico"
                  : cd.tone === "soon"
                    ? "🟠 Ajustado"
                    : cd.tone === "ok"
                      ? "🟢 Holgado"
                      : "—"
            }
          />
          <Kpi
            label="Responsable"
            value={bidCase.owner_name?.trim() || "Sin asignar"}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {tenderSummary ? (
            <Link
              href={`/tenders/${tenderSummary.id}?from=mis-licitaciones`}
              className="inline-flex rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              Ficha pública
            </Link>
          ) : null}
          <span className="inline-flex items-center rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground">
            Etapa: {stageLabel}
          </span>
        </div>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 rounded-xl border border-border bg-surface p-4 sm:p-5">
          <DetailTabs
            panes={{
              resumen: (
                <div className="space-y-4 text-sm">
                  <p className="text-muted-foreground">
                    Cabecera del expediente y datos editables. La matriz de
                    requisitos estructurada (excluyente / preparación) llegará
                    en el siguiente incremento; de momento el checklist actúa
                    como base.
                  </p>
                  <CaseMetaForm
                    caseId={bidCase.id}
                    afterDeleteHref="/mis-licitaciones"
                    initial={{
                      stage: bidCase.stage,
                      owner_name: bidCase.owner_name,
                      preparation_started_on: bidCase.preparation_started_on,
                      presented_on: bidCase.presented_on,
                      outcome_on: bidCase.outcome_on,
                      notes: bidCase.notes,
                    }}
                  />
                </div>
              ),
              requisitos: (
                <div>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Checklist actual (base). Cada ítem se migrará a requisito
                    con categoría, ¿cumplimos? y preparación.
                  </p>
                  <ChecklistPanel
                    caseId={bidCase.id}
                    items={bidCase.checklist}
                  />
                </div>
              ),
              sobres: (
                <div className="space-y-3 text-sm text-muted-foreground">
                  <SobreCard
                    title="Sobre A — Administrativo"
                    hint="DEUC, declaraciones, solvencia formal…"
                  />
                  <SobreCard
                    title="Sobre B — Juicio de valor"
                    hint="Memoria técnica por criterio (próximo incremento)."
                  />
                  <SobreCard
                    title="Sobre C — Fórmula"
                    hint="Oferta económica y mejoras cuantificables."
                  />
                </div>
              ),
              pliegos: (
                <div>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Enlaces a Drive/SharePoint y biblioteca reutilizable.
                  </p>
                  <DocumentsPanel
                    caseId={bidCase.id}
                    userId={profile.data.id}
                    linked={bidCase.documents}
                    library={(libraryResult.data ?? []).map((d) => ({
                      id: d.id,
                      title: d.title,
                      url: d.url,
                      tags: d.tags,
                    }))}
                  />
                </div>
              ),
              equipo: (
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Responsable:</span>{" "}
                    {bidCase.owner_name?.trim() || "Sin asignar"}
                  </p>
                  <p className="text-muted-foreground">
                    Equipo con roles (preparador / revisor / aprobador) y
                    personal adscrito llegarán cuando el responsable sea
                    usuario de la app.
                  </p>
                </div>
              ),
              calendario: (
                <ul className="space-y-2 text-sm">
                  <CalRow
                    label="Publicación"
                    value={
                      tenderSummary?.publication_date
                        ? formatDateMadrid(tenderSummary.publication_date)
                        : "—"
                    }
                  />
                  <CalRow
                    label="Plazo de presentación"
                    value={
                      tenderSummary?.deadline_at
                        ? formatDateTimeMadrid(tenderSummary.deadline_at)
                        : "—"
                    }
                  />
                  <CalRow
                    label="Inicio preparación"
                    value={
                      bidCase.preparation_started_on
                        ? formatDateMadrid(bidCase.preparation_started_on)
                        : "—"
                    }
                  />
                  <CalRow
                    label="Presentada / outcome"
                    value={
                      bidCase.outcome_on || bidCase.presented_on
                        ? formatDateMadrid(
                            bidCase.outcome_on ?? bidCase.presented_on,
                          )
                        : "—"
                    }
                  />
                </ul>
              ),
              bitacora: (
                <div>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Novedades y comentarios del expediente.
                  </p>
                  <UpdatesPanel
                    caseId={bidCase.id}
                    userId={profile.data.id}
                    updates={bidCase.updates}
                  />
                </div>
              ),
            }}
          />
        </div>

        <aside className="h-fit rounded-xl border border-border bg-surface p-4 lg:sticky lg:top-24">
          <h2 className="text-sm font-semibold text-foreground">Qué falta</h2>
          {isHistoric(bidCase.stage) ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Expediente histórico. El panel accionable aplica a activas.
            </p>
          ) : missing.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No hay pendientes en el checklist.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {missing.map((m) => (
                <li
                  key={`${m.title}-${m.detail}`}
                  className={cn(
                    "rounded-r-md border-l-4 px-3 py-2 text-sm",
                    m.tone === "bad" &&
                      "border-destructive bg-destructive/10 text-foreground",
                    m.tone === "warn" &&
                      "border-amber-500 bg-amber-50 text-foreground",
                  )}
                >
                  <p className="font-medium">{m.title}</p>
                  <p className="text-xs text-muted-foreground">{m.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </main>
  );
}

function Kpi({
  label,
  value,
  bar,
}: {
  label: string;
  value: string;
  bar?: number | null;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/50 px-3 py-2.5">
      <p className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
      {bar != null ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.min(100, Math.max(0, bar))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function SobreCard({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs">{hint}</p>
    </div>
  );
}

function CalRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </li>
  );
}
