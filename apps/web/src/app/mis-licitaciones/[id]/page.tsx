import { notFound } from "next/navigation";
import {
  getSessionProfile,
  getSupabaseServerClient,
} from "@/lib/auth/session";
import {
  HISTORIC_OFFER_STAGES,
  OFFER_STAGE_LABELS,
  asOfferCaseKind,
  getEficenMemberIdByUserId,
  getLatestOfferCaseIntake,
  getOfferCaseById,
  getTenderById,
  listOfferCaseMembers,
  listOfferCasePliegos,
  listOfferDeliverables,
  listOfferMilestones,
  listOfferTasks,
  type OfferCaseTeamMember,
  type OfferOwnerMember,
  type OfferStage,
} from "@/lib/queries";
import {
  formatCountdown,
  formatDeadlineDaysPhrase,
} from "@/lib/bid-countdown";
import { formatDateMadrid, formatDateTimeMadrid } from "@/lib/datetime";
import { formatTenderStatus } from "@/lib/tender-labels";
import {
  PAGE_MAIN_FAVORITES_CLASS,
  PAGE_MAIN_WIDE_CLASS,
} from "@/components/shell/page-width";
import { ErrorState } from "@/components/ui/state-message";
import { FavoriteKindBubble } from "@/components/favorites/favorite-kind-bubble";
import { DetailTabs } from "@/components/mis-licitaciones/detail-tabs";
import { OfferCaseIntakeStatus } from "@/components/mis-licitaciones/offer-case-intake-status";
import {
  PliegosList,
  SobresList,
} from "@/components/mis-licitaciones/offer-case-sections";
import { OfferRequirementsTable } from "@/components/mis-licitaciones/offer-requirements-table";
import { OfferCaseTeamPanel } from "@/components/mis-licitaciones/offer-case-team-panel";
import {
  AdvanceToAnalisisButton,
  AdvanceToAnalisisLink,
} from "@/components/mis-licitaciones/advance-to-analisis-button";
import { AwardCriteriaSummary } from "@/components/mis-licitaciones/award-criteria-summary";
import {
  OfferCalendarTimeline,
  type OfferCalendarEvent,
} from "@/components/mis-licitaciones/offer-calendar-timeline";
import { OfferCaseLogPanel } from "@/components/mis-licitaciones/offer-case-log-panel";
import { OfferGoDecisionCard } from "@/components/mis-licitaciones/offer-go-decision-card";
import { buildMissingItems } from "@/components/mis-licitaciones/offer-missing-items";
import { OfferMissingPanel } from "@/components/mis-licitaciones/offer-missing-panel";
import { OfferTasksPanel } from "@/components/mis-licitaciones/offer-tasks-panel";
import { TenderFichaModalButton } from "@/components/mis-licitaciones/tender-ficha-modal";
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
  return (HISTORIC_OFFER_STAGES as readonly string[]).includes(stage);
}

export default async function MisLicitacionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const profile = await getSessionProfile();
  if (!profile.data) {
    return (
      <main className={PAGE_MAIN_WIDE_CLASS}>
        <ErrorState>
          No se pudo cargar tu cuenta. Cierra sesión e inicia de nuevo, o
          contacta con soporte.
        </ErrorState>
      </main>
    );
  }

  const { data: offerCase, error } = await getOfferCaseById(supabase, id);

  if (error) {
    return (
      <main className={PAGE_MAIN_WIDE_CLASS}>
        <ErrorState>
          No se pudo cargar el expediente. Inténtalo de nuevo.
        </ErrorState>
      </main>
    );
  }
  if (!offerCase) notFound();

  const [
    teamResult,
    intakeResult,
    pliegosResult,
    deliverablesResult,
    milestonesResult,
    viewerMemberResult,
    tasksResult,
  ] = await Promise.all([
    listOfferCaseMembers(supabase, offerCase.id),
    getLatestOfferCaseIntake(supabase, offerCase.id),
    listOfferCasePliegos(supabase, offerCase.id),
    listOfferDeliverables(supabase, offerCase.id),
    listOfferMilestones(supabase, offerCase.id),
    getEficenMemberIdByUserId(supabase, profile.data.id),
    listOfferTasks(supabase, offerCase.id),
  ]);
  const teamMembers = teamResult.data;
  const viewerMemberId = viewerMemberResult.data;
  const tasks = tasksResult.data;
  const milestones = milestonesResult.data;
  const hasPresentationMilestone = milestones.some(
    (m) => m.code === "presentacion",
  );
  const tenderSummary = offerCase.tenders;
  const calendarEvents: OfferCalendarEvent[] = [];
  if (tenderSummary?.publication_date) {
    calendarEvents.push({
      id: "pub",
      title: "Publicación",
      dueAt: tenderSummary.publication_date,
      kind: "oficial",
    });
  }
  for (const m of milestones) {
    if (!m.due_at) continue;
    calendarEvents.push({
      id: `ms:${m.id}`,
      title: m.title,
      dueAt: m.due_at,
      kind: m.kind === "interno" ? "interno" : "oficial",
    });
  }
  if (!hasPresentationMilestone && tenderSummary?.deadline_at) {
    calendarEvents.push({
      id: "deadline",
      title: "Plazo de presentación",
      dueAt: tenderSummary.deadline_at,
      kind: "oficial",
    });
  }
  if (offerCase.internal_deadline_at) {
    calendarEvents.push({
      id: "internal",
      title: "Cierre interno",
      dueAt: offerCase.internal_deadline_at,
      kind: "interno",
    });
  }
  if (offerCase.preparation_started_on) {
    calendarEvents.push({
      id: "prep",
      title: "Inicio preparación",
      dueAt: offerCase.preparation_started_on,
      kind: "interno",
    });
  }
  if (offerCase.presented_on) {
    calendarEvents.push({
      id: "presented",
      title: "Presentada",
      dueAt: offerCase.presented_on,
      kind: "interno",
    });
  }
  if (offerCase.outcome_on) {
    calendarEvents.push({
      id: "outcome",
      title: "Resolución / desenlace",
      dueAt: offerCase.outcome_on,
      kind: "oficial",
    });
  }
  const showCalendarTab = calendarEvents.length > 0;
  const tenderDetailResult = tenderSummary
    ? await getTenderById(supabase, tenderSummary.id)
    : { data: null, error: null };
  const tenderFull = tenderDetailResult.data;

  /** Riesgo plazo = deadline oficial de la licitación (no plazos internos de requisitos). */
  const due = tenderSummary?.deadline_at ?? null;
  const historic = isHistoric(offerCase.stage);
  const cd = formatCountdown(historic ? null : due);
  const total = offerCase.requirements.length;
  const ready = offerCase.requirements.filter(
    (r) => r.prep_status === "listo",
  ).length;
  const prepPct = total > 0 ? Math.round((ready / total) * 100) : null;
  const excl = offerCase.requirements.filter(
    (r) => r.requirement_type === "excluyente",
  );
  const exclOk = excl.filter((r) => r.compliance_status === "cumple").length;

  const matrixReqs = offerCase.requirements.filter(
    (r) => r.category !== "criterio_adjudicacion",
  );
  const missing = historic
    ? []
    : buildMissingItems(matrixReqs, tasks, {
        viewerMemberId,
      });

  const stageLabel =
    offerCase.stage in OFFER_STAGE_LABELS
      ? OFFER_STAGE_LABELS[offerCase.stage as OfferStage]
      : offerCase.stage;

  return (
    <main
      className={historic ? PAGE_MAIN_FAVORITES_CLASS : PAGE_MAIN_WIDE_CLASS}
    >
      <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {tenderSummary?.title ?? "Licitación eliminada"}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <FavoriteKindBubble kind={asOfferCaseKind(offerCase.kind)} />
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
              {offerCase.outcome_on ? (
                <span>Outcome {formatDateMadrid(offerCase.outcome_on)}</span>
              ) : null}
            </div>
          </div>
          {tenderFull ? <TenderFichaModalButton tender={tenderFull} /> : null}
        </div>

        <div
          className={cn(
            "mt-4 grid gap-2.5 pt-1 sm:grid-cols-2",
            historic ? "lg:grid-cols-2" : "lg:grid-cols-5",
          )}
        >
          {!historic ? (
            <Kpi
              label="Requisitos excluyentes"
              value={
                excl.length > 0
                  ? `${exclOk}/${excl.length}`
                  : total > 0
                    ? `${ready}/${total} prep.`
                    : "Sin requisitos"
              }
              valueSize="lg"
            />
          ) : null}
          {!historic ? (
            <Kpi
              label="Preparación"
              value={prepPct != null ? `${prepPct}%` : "—"}
              bar={prepPct}
            />
          ) : null}
          {offerCase.stage === "interes" ? (
            <OutlinedField label="Estado">
              <p className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {stageLabel}
              </p>
              <AdvanceToAnalisisLink
                offerCaseId={offerCase.id}
                userId={profile.data.id}
              />
            </OutlinedField>
          ) : (
            <Kpi
              label="Estado"
              value={stageLabel}
              valueSize="lg"
              className={
                historic
                  ? "flex min-h-[4.75rem] flex-col justify-center"
                  : undefined
              }
            />
          )}
          {!historic ? (
            <DeadlineRiskKpi
              historic={historic}
              dueIso={due}
              tone={cd.tone}
            />
          ) : null}
          <OwnerTeamKpi
            owner={offerCase.owner_member}
            team={teamMembers}
            className={
              historic
                ? "flex min-h-[4.75rem] flex-col justify-center"
                : undefined
            }
          />
        </div>
      </section>

      <div
        className={cn(
          "mt-6 grid gap-4",
          !historic && "lg:grid-cols-[minmax(0,1fr)_260px]",
        )}
      >
        <div className="min-w-0 rounded-xl border border-border bg-surface p-4 sm:p-5">
          <DetailTabs
            panes={{
              resumen: (
                <div className="space-y-5 text-sm">
                  {offerCase.stage === "interes" ? (
                    <AdvanceToAnalisisButton
                      offerCaseId={offerCase.id}
                      userId={profile.data.id}
                    />
                  ) : null}
                  {offerCase.stage === "analisis" ||
                  offerCase.go_decision === "go" ||
                  offerCase.go_decision === "no_go" ? (
                    <OfferGoDecisionCard
                      offerCaseId={offerCase.id}
                      userId={profile.data.id}
                      decision={offerCase.go_decision}
                      reason={offerCase.go_reason}
                      decidedAt={offerCase.go_decided_at}
                      decidedByName={offerCase.go_decider_name}
                    />
                  ) : null}

                  <AwardCriteriaSummary
                    deliverables={deliverablesResult.data}
                  />

                  <div className="rounded-xl border border-border bg-muted/25 p-4 sm:p-5">
                    <h3 className="text-sm font-semibold text-foreground">
                      Notas / estrategia
                    </h3>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
                      {offerCase.notes?.trim() || (
                        <span className="text-muted-foreground">Sin notas.</span>
                      )}
                    </p>
                  </div>
                </div>
              ),
              requisitos:
                matrixReqs.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                    Sin requisitos en este expediente.
                  </p>
                ) : (
                  <OfferRequirementsTable
                    offerCaseId={offerCase.id}
                    requirements={matrixReqs}
                    owner={offerCase.owner_member}
                    team={teamMembers}
                    actionsLocked={offerCase.stage === "interes"}
                  />
                ),
              sobres: (
                <SobresList
                  deliverables={deliverablesResult.data}
                  requirements={matrixReqs}
                />
              ),
              pliegos: (
                <div className="space-y-3 text-sm">
                  <OfferCaseIntakeStatus
                    offerCaseId={offerCase.id}
                    userId={profile.data.id}
                    intake={intakeResult.data}
                    hasStructuredData={
                      (pliegosResult.data?.length ?? 0) > 0 ||
                      offerCase.requirements.length > 0 ||
                      (deliverablesResult.data?.length ?? 0) > 0
                    }
                  />
                  {pliegosResult.error ? (
                    <ErrorState>
                      No se pudo cargar los pliegos. Inténtalo de nuevo.
                    </ErrorState>
                  ) : (
                    <PliegosList
                      pliegos={pliegosResult.data}
                      intakeStatus={
                        (intakeResult.data?.status as
                          | "pending"
                          | "processing"
                          | "done"
                          | "failed"
                          | null
                          | undefined) ?? null
                      }
                    />
                  )}
                </div>
              ),
              equipo: (
                <OfferCaseTeamPanel
                  offerCaseId={offerCase.id}
                  owner={offerCase.owner_member}
                  team={teamMembers}
                  workersEnabled={offerCase.stage !== "interes"}
                />
              ),
              tareas: (
                <OfferTasksPanel
                  offerCaseId={offerCase.id}
                  userId={profile.data.id}
                  viewerMemberId={viewerMemberId}
                  owner={offerCase.owner_member}
                  team={teamMembers}
                />
              ),
              calendario: showCalendarTab ? (
                <OfferCalendarTimeline events={calendarEvents} />
              ) : null,
              bitacora: (
                <OfferCaseLogPanel
                  offerCaseId={offerCase.id}
                  userId={profile.data.id}
                />
              ),
            }}
          />
        </div>

        {!historic ? <OfferMissingPanel items={missing} /> : null}
      </div>
    </main>
  );
}

/** Contenedor estilo outlined: título “recortado” en el borde superior. */
function OutlinedField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <fieldset
      className={cn(
        "min-w-0 rounded-md border border-primary px-3 pb-2.5 pt-1",
        className,
      )}
    >
      <legend className="px-1 text-[0.7rem] font-medium leading-none text-primary">
        {label}
      </legend>
      {children}
    </fieldset>
  );
}

function Kpi({
  label,
  value,
  bar,
  valueSize = "md",
  className,
}: {
  label: string;
  value: string;
  bar?: number | null;
  valueSize?: "md" | "lg";
  className?: string;
}) {
  return (
    <OutlinedField label={label} className={className}>
      <p
        className={cn(
          "font-semibold text-foreground",
          valueSize === "lg"
            ? "text-xl tracking-tight sm:text-2xl"
            : "text-base",
        )}
      >
        {value}
      </p>
      {bar != null ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.min(100, Math.max(0, bar))}%` }}
          />
        </div>
      ) : null}
    </OutlinedField>
  );
}

function DeadlineRiskKpi({
  historic,
  dueIso,
  tone,
}: {
  historic: boolean;
  dueIso: string | null;
  tone: "ok" | "soon" | "overdue" | "none";
}) {
  const headline = historic
    ? "Histórico"
    : tone === "overdue"
      ? "🔴 Crítico"
      : tone === "soon"
        ? "🟠 Ajustado"
        : tone === "ok"
          ? "🟢 Holgado"
          : "—";

  const days = historic
    ? { phrase: null as string | null, tone: "none" as const }
    : formatDeadlineDaysPhrase(dueIso);

  const phraseTone = days.tone;
  const phraseClass =
    phraseTone === "overdue"
      ? "text-destructive"
      : phraseTone === "soon"
        ? "text-amber-700"
        : phraseTone === "ok"
          ? "text-emerald-700"
          : "text-muted-foreground";

  return (
    <OutlinedField label="Riesgo plazo">
      <p
        className={cn(
          "text-xl font-semibold tracking-tight sm:text-2xl",
          tone === "overdue" && "text-destructive",
          tone === "soon" && "text-amber-700",
          tone === "ok" && "text-emerald-700",
          (tone === "none" || historic) && "text-foreground",
        )}
      >
        {headline}
      </p>
      {days.phrase ? (
        <p className={cn("mt-1 text-sm font-medium", phraseClass)}>
          {days.phrase}
        </p>
      ) : !historic && tone === "none" ? (
        <p className="mt-1 text-sm text-muted-foreground">Sin plazo</p>
      ) : null}
    </OutlinedField>
  );
}

function personInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function PersonAvatar({
  name,
  avatarUrl,
  size,
  className,
}: {
  name: string;
  avatarUrl: string | null;
  size: "md" | "sm";
  className?: string;
}) {
  const dim = size === "md" ? "size-9 text-xs" : "size-7 text-[0.65rem]";
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        title={name}
        className={cn(
          dim,
          "shrink-0 rounded-full object-cover ring-2 ring-surface",
          className,
        )}
      />
    );
  }
  return (
    <span
      title={name}
      className={cn(
        dim,
        "inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-foreground ring-2 ring-surface",
        className,
      )}
      aria-hidden
    >
      {personInitials(name)}
    </span>
  );
}

/** KPI «Responsable y equipo»: avatar + nombre del owner y fila de avatares del equipo. */
function OwnerTeamKpi({
  owner,
  team,
  className,
}: {
  owner: OfferOwnerMember | null;
  team: OfferCaseTeamMember[];
  className?: string;
}) {
  const ownerName = owner?.display_name?.trim() || null;
  const crew = team.filter((row) => row.member_id !== owner?.id);
  const visible = crew.slice(0, 5);
  const extra = crew.length - visible.length;

  return (
    <OutlinedField label="Responsable y equipo" className={className}>
      <div className="flex min-w-0 items-center gap-2.5">
        {owner && ownerName ? (
          <>
            <PersonAvatar
              name={ownerName}
              avatarUrl={owner.avatar_url}
              size="md"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {ownerName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Responsable del expediente
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm font-semibold text-muted-foreground">
            {crew.length > 0 ? "Responsable sin asignar" : "Sin asignar"}
          </p>
        )}
      </div>
      {crew.length > 0 ? (
        <div className="mt-2.5 flex items-center">
          {visible.map((row, index) => (
            <PersonAvatar
              key={row.id}
              name={row.member.display_name}
              avatarUrl={row.member.avatar_url}
              size="sm"
              className={cn(index > 0 && "-ml-1")}
            />
          ))}
          {extra > 0 ? (
            <span
              className={cn(
                "inline-flex size-7 items-center justify-center rounded-full bg-muted text-[0.65rem] font-semibold text-muted-foreground ring-2 ring-surface",
                visible.length > 0 && "-ml-1",
              )}
            >
              +{extra}
            </span>
          ) : null}
        </div>
      ) : null}
    </OutlinedField>
  );
}

