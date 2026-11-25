import { notFound } from "next/navigation";
import {
  getSessionProfile,
  getSupabaseServerClient,
} from "@/lib/auth/session";
import {
  HISTORIC_OFFER_STAGES,
  OFFER_STAGE_LABELS,
  asOfferCaseKind,
  getLatestOfferCaseIntake,
  getOfferCaseById,
  getTenderById,
  listEficenMembersForTeam,
  listOfferCaseMembers,
  listOfferCasePliegos,
  listOfferDeliverables,
  listOfferMilestones,
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
import { PAGE_MAIN_WIDE_CLASS } from "@/components/shell/page-width";
import { ErrorState } from "@/components/ui/state-message";
import { FavoriteKindBubble } from "@/components/favorites/favorite-kind-bubble";
import { DetailTabs } from "@/components/mis-licitaciones/detail-tabs";
import { OfferCaseIntakeStatus } from "@/components/mis-licitaciones/offer-case-intake-status";
import {
  MilestoneRows,
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
import { OfferCaseLogPanel } from "@/components/mis-licitaciones/offer-case-log-panel";
import { OfferGoDecisionCard } from "@/components/mis-licitaciones/offer-go-decision-card";
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
          No hay perfil en public.users:{" "}
          {profile.error?.message ?? "desconocido"}
        </ErrorState>
      </main>
    );
  }

  const { data: offerCase, error } = await getOfferCaseById(supabase, id);

  if (error) {
    return (
      <main className={PAGE_MAIN_WIDE_CLASS}>
        <ErrorState>{error.message}</ErrorState>
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
    membersResult,
  ] = await Promise.all([
    listOfferCaseMembers(supabase, offerCase.id),
    getLatestOfferCaseIntake(supabase, offerCase.id),
    listOfferCasePliegos(supabase, offerCase.id),
    listOfferDeliverables(supabase, offerCase.id),
    listOfferMilestones(supabase, offerCase.id),
    listEficenMembersForTeam(supabase),
  ]);
  const teamMembers = teamResult.data;
  const milestones = milestonesResult.data;
  const hasPresentationMilestone = milestones.some(
    (m) => m.code === "presentacion",
  );
  const tenderSummary = offerCase.tenders;
  const tenderDetailResult = tenderSummary
    ? await getTenderById(supabase, tenderSummary.id)
    : { data: null, error: null };
  const tenderFull = tenderDetailResult.data;

  const pendingReqs = offerCase.requirements.filter(
    (r) => r.prep_status !== "listo",
  );
  const due =
    pendingReqs.find((r) => r.internal_due_at)?.internal_due_at ??
    offerCase.internal_deadline_at ??
    tenderSummary?.deadline_at ??
    null;
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

  const missing = [
    ...offerCase.requirements
      .filter((r) => r.compliance_status === "no_cumple")
      .map((r) => ({
        tone: "bad" as const,
        title: r.title,
        detail: "Excluyente / no cumple",
      })),
    ...pendingReqs
      .filter(
        (r) =>
          r.internal_due_at && new Date(r.internal_due_at).getTime() < Date.now(),
      )
      .map((r) => ({
        tone: "bad" as const,
        title: r.title,
        detail: "Vencido",
      })),
    ...pendingReqs
      .filter(
        (r) =>
          !r.internal_due_at ||
          new Date(r.internal_due_at).getTime() >= Date.now(),
      )
      .slice(0, 6)
      .map((r) => ({
        tone: "warn" as const,
        title: r.title,
        detail: r.internal_due_at
          ? `Vence ${formatDateMadrid(r.internal_due_at)}`
          : "Pendiente de preparar",
      })),
  ];

  const stageLabel =
    offerCase.stage in OFFER_STAGE_LABELS
      ? OFFER_STAGE_LABELS[offerCase.stage as OfferStage]
      : offerCase.stage;

  return (
    <main className={PAGE_MAIN_WIDE_CLASS}>
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

        <div className="mt-4 grid gap-2.5 pt-1 sm:grid-cols-2 lg:grid-cols-5">
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
          <Kpi
            label="Preparación"
            value={prepPct != null ? `${prepPct}%` : "—"}
            bar={prepPct}
          />
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
            <Kpi label="Estado" value={stageLabel} valueSize="lg" />
          )}
          <DeadlineRiskKpi
            historic={historic}
            dueIso={due}
            tone={cd.tone}
          />
          <OwnerTeamKpi
            owner={offerCase.owner_member}
            team={teamMembers}
          />
        </div>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
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
                    requirements={offerCase.requirements}
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
                offerCase.requirements.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                    Sin requisitos en este expediente.
                  </p>
                ) : (
                  <OfferRequirementsTable
                    offerCaseId={offerCase.id}
                    requirements={offerCase.requirements}
                    members={membersResult.data}
                    actionsLocked={offerCase.stage === "interes"}
                  />
                ),
              sobres: (
                <SobresList
                  deliverables={deliverablesResult.data}
                  requirements={offerCase.requirements}
                />
              ),
              pliegos: (
                <div className="space-y-3 text-sm">
                  <OfferCaseIntakeStatus
                    offerCaseId={offerCase.id}
                    userId={profile.data.id}
                    intake={intakeResult.data}
                  />
                  {pliegosResult.error ? (
                    <ErrorState>{pliegosResult.error.message}</ErrorState>
                  ) : (
                    <PliegosList pliegos={pliegosResult.data} />
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
                  members={membersResult.data}
                />
              ),
              calendario: (
                <ul className="space-y-0 text-sm">
                  <CalRow
                    label="Actualizado"
                    value={
                      tenderSummary?.publication_date
                        ? formatDateMadrid(tenderSummary.publication_date)
                        : "—"
                    }
                    kind="Oficial"
                  />
                  <MilestoneRows milestones={milestones} />
                  {hasPresentationMilestone ? null : (
                    <CalRow
                      label="Plazo de presentación"
                      value={
                        tenderSummary?.deadline_at
                          ? formatDateTimeMadrid(tenderSummary.deadline_at)
                          : "—"
                      }
                      kind="Oficial"
                    />
                  )}
                  <CalRow
                    label="Cierre interno"
                    value={
                      offerCase.internal_deadline_at
                        ? formatDateTimeMadrid(offerCase.internal_deadline_at)
                        : "—"
                    }
                    kind="Interno"
                  />
                  <CalRow
                    label="Inicio preparación"
                    value={
                      offerCase.preparation_started_on
                        ? formatDateMadrid(offerCase.preparation_started_on)
                        : "—"
                    }
                    kind="Interno"
                  />
                  <CalRow
                    label="Presentada"
                    value={
                      offerCase.presented_on
                        ? formatDateMadrid(offerCase.presented_on)
                        : "—"
                    }
                    kind="Interno"
                  />
                  <CalRow
                    label="Outcome"
                    value={
                      offerCase.outcome_on
                        ? formatDateMadrid(offerCase.outcome_on)
                        : "—"
                    }
                    kind="Oficial"
                  />
                </ul>
              ),
              bitacora: (
                <OfferCaseLogPanel
                  offerCaseId={offerCase.id}
                  userId={profile.data.id}
                />
              ),
            }}
          />
        </div>

        <aside className="h-fit rounded-xl border border-border bg-surface p-4 lg:sticky lg:top-24">
          <h2 className="text-sm font-semibold text-foreground">Qué falta</h2>
          {historic ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Expediente histórico. El panel accionable aplica a activas.
            </p>
          ) : missing.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No hay pendientes detectados.
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
}: {
  label: string;
  value: string;
  bar?: number | null;
  valueSize?: "md" | "lg";
}) {
  return (
    <OutlinedField label={label}>
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
}: {
  owner: OfferOwnerMember | null;
  team: OfferCaseTeamMember[];
}) {
  const ownerName = owner?.display_name?.trim() || null;
  const crew = team.filter((row) => row.member_id !== owner?.id);
  const visible = crew.slice(0, 5);
  const extra = crew.length - visible.length;

  return (
    <OutlinedField label="Responsable y equipo">
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

function CalRow({
  label,
  value,
  kind,
}: {
  label: string;
  value: string;
  kind: string;
}) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border py-2.5">
      <div>
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{kind}</p>
      </div>
      <span className="text-foreground">{value}</span>
    </li>
  );
}
