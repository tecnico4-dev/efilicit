import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getSessionProfile,
  getSupabaseServerClient,
} from "@/lib/auth/session";
import {
  HISTORIC_OFFER_STAGES,
  OFFER_STAGE_LABELS,
  getOfferCaseById,
  getTenderById,
  type OfferStage,
} from "@/lib/queries";
import { formatCountdown } from "@/lib/bid-countdown";
import { formatDateMadrid, formatDateTimeMadrid } from "@/lib/datetime";
import { formatTenderStatus } from "@/lib/tender-labels";
import { PAGE_MAIN_CLASS } from "@/components/shell/page-width";
import { ErrorState } from "@/components/ui/state-message";
import { CaseStageBadge } from "@/components/mis-licitaciones/case-stage-badge";
import { DetailTabs } from "@/components/mis-licitaciones/detail-tabs";
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

const COMPLIANCE_LABEL: Record<string, string> = {
  cumple: "cumple",
  parcial: "parcial",
  no_cumple: "no cumple",
  sin_verificar: "sin verificar",
  no_aplica: "no aplica",
};

const PREP_LABEL: Record<string, string> = {
  pendiente: "pendiente",
  en_curso: "en curso",
  en_revision: "en revisión",
  listo: "listo",
};

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

  const { data: offerCase, error } = await getOfferCaseById(supabase, id);

  if (error) {
    return (
      <main className={PAGE_MAIN_CLASS}>
        <ErrorState>{error.message}</ErrorState>
      </main>
    );
  }
  if (!offerCase) notFound();

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
    <main className={PAGE_MAIN_CLASS}>
      <Link
        href={historic ? "/mis-licitaciones?tab=historic" : "/mis-licitaciones"}
        className="mb-4 inline-flex text-sm font-medium text-link hover:underline"
      >
        ← Volver al pipeline
      </Link>

      <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CaseStageBadge stage={offerCase.stage} />
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
              {offerCase.owner_name ? (
                <span>Resp. {offerCase.owner_name}</span>
              ) : null}
              {offerCase.outcome_on ? (
                <span>Outcome {formatDateMadrid(offerCase.outcome_on)}</span>
              ) : null}
            </div>
          </div>
          {tenderFull ? <TenderFichaModalButton tender={tenderFull} /> : null}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Cumplimiento excl."
            value={
              excl.length > 0
                ? `${exclOk}/${excl.length}`
                : total > 0
                  ? `${ready}/${total} prep.`
                  : "Sin requisitos"
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
              historic
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
            value={offerCase.owner_name?.trim() || "Sin asignar"}
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
                <div className="space-y-5 text-sm">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Ficha condensada
                    </h3>
                    <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                      <Fact
                        label="Objeto"
                        value={tenderSummary?.title ?? "—"}
                      />
                      <Fact
                        label="Estado publicación"
                        value={
                          tenderSummary?.status
                            ? formatTenderStatus(tenderSummary.status)
                            : "—"
                        }
                      />
                      <Fact
                        label="Importe estimado"
                        value={
                          tenderSummary
                            ? formatMoney(
                                tenderSummary.estimated_value,
                                tenderSummary.currency,
                              )
                            : "—"
                        }
                      />
                      <Fact
                        label="Publicación"
                        value={
                          tenderSummary?.publication_date
                            ? formatDateMadrid(tenderSummary.publication_date)
                            : "—"
                        }
                      />
                      <Fact label="Etapa pipeline" value={stageLabel} />
                      <Fact
                        label="Responsable"
                        value={offerCase.owner_name?.trim() || "Sin asignar"}
                      />
                    </dl>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Decisión go / no-go
                    </h3>
                    <p className="mt-2 text-muted-foreground">
                      {offerCase.go_decision
                        ? `${offerCase.go_decision}${
                            offerCase.go_reason
                              ? ` · ${offerCase.go_reason}`
                              : ""
                          }`
                        : "Aún no hay decisión registrada."}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Notas / estrategia
                    </h3>
                    <p className="mt-2 whitespace-pre-wrap text-foreground">
                      {offerCase.notes?.trim() || "Sin notas."}
                    </p>
                  </div>
                </div>
              ),
              requisitos: (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Matriz en `offer_requirements` (ADR 026). Filas migradas del
                    checklist legacy aparecen como categoría «otros».
                  </p>
                  {offerCase.requirements.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                      Sin requisitos en este expediente.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                            <th className="px-2 py-2 font-semibold">
                              Requisito
                            </th>
                            <th className="px-2 py-2 font-semibold">Tipo</th>
                            <th className="px-2 py-2 font-semibold">
                              ¿Cumplimos?
                            </th>
                            <th className="px-2 py-2 font-semibold">
                              Preparación
                            </th>
                            <th className="px-2 py-2 font-semibold">
                              Fecha interna
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {offerCase.requirements.map((item) => (
                            <tr
                              key={item.id}
                              className="border-b border-border/80"
                            >
                              <td className="px-2 py-2.5 font-medium text-foreground">
                                {item.title}
                                <p className="text-xs font-normal text-muted-foreground">
                                  {item.category}
                                  {item.source_kind === "legacy_checklist"
                                    ? " · legacy"
                                    : ""}
                                </p>
                              </td>
                              <td className="px-2 py-2.5 text-muted-foreground">
                                {item.requirement_type}
                              </td>
                              <td className="px-2 py-2.5">
                                <StatusChip
                                  tone={
                                    item.compliance_status === "cumple"
                                      ? "ok"
                                      : item.compliance_status === "no_cumple"
                                        ? "bad"
                                        : item.compliance_status ===
                                            "sin_verificar"
                                          ? "warn"
                                          : "muted"
                                  }
                                >
                                  {COMPLIANCE_LABEL[item.compliance_status] ??
                                    item.compliance_status}
                                </StatusChip>
                              </td>
                              <td className="px-2 py-2.5">
                                <StatusChip
                                  tone={
                                    item.prep_status === "listo" ? "ok" : "warn"
                                  }
                                >
                                  {PREP_LABEL[item.prep_status] ??
                                    item.prep_status}
                                </StatusChip>
                              </td>
                              <td className="px-2 py-2.5 text-muted-foreground">
                                {item.internal_due_at
                                  ? formatDateMadrid(item.internal_due_at)
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ),
              sobres: (
                <div className="space-y-3">
                  <SobreCard
                    title="Sobre A — Documentación administrativa"
                    progress={null}
                    hint="DEUC, declaraciones, solvencia formal."
                  />
                  <SobreCard
                    title="Sobre B — Criterios de juicio de valor"
                    progress={null}
                    hint="Memoria técnica por criterio."
                  />
                  <SobreCard
                    title="Sobre C — Criterios por fórmula"
                    progress={null}
                    hint="Oferta económica y mejoras cuantificables."
                  />
                </div>
              ),
              pliegos: (
                <div className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    Pliegos y fuentes (próximo incremento). Expediente en
                    `offer_cases`.
                  </p>
                  <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-muted-foreground">
                    Sin PCAP/PPT/anexos vinculados · sin fuentes registradas
                  </div>
                </div>
              ),
              equipo: (
                <div className="space-y-3 text-sm">
                  <Fact
                    label="Responsable del expediente"
                    value={offerCase.owner_name?.trim() || "Sin asignar"}
                  />
                  <p className="text-muted-foreground">
                    Equipo con roles llegará cuando `owner_user_id` esté en uso.
                  </p>
                </div>
              ),
              calendario: (
                <ul className="space-y-0 text-sm">
                  <CalRow
                    label="Publicación"
                    value={
                      tenderSummary?.publication_date
                        ? formatDateMadrid(tenderSummary.publication_date)
                        : "—"
                    }
                    kind="Oficial"
                  />
                  <CalRow
                    label="Plazo de presentación"
                    value={
                      tenderSummary?.deadline_at
                        ? formatDateTimeMadrid(tenderSummary.deadline_at)
                        : "—"
                    }
                    kind="Oficial"
                  />
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
                <div className="space-y-3 text-sm">
                  <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-muted-foreground">
                    Bitácora tipada en un incremento posterior. El expediente ya
                    está en `offer_cases`.
                  </p>
                </div>
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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
    </div>
  );
}

function StatusChip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "ok" | "warn" | "bad" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold",
        tone === "ok" &&
          "border-emerald-300/60 bg-emerald-50 text-emerald-900",
        tone === "warn" && "border-amber-300/60 bg-amber-50 text-amber-900",
        tone === "bad" &&
          "border-destructive/40 bg-destructive/10 text-destructive",
        tone === "muted" && "border-border bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function SobreCard({
  title,
  hint,
  progress,
}: {
  title: string;
  hint: string;
  progress: number | null;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium text-foreground">{title}</p>
        <span className="text-xs text-muted-foreground">
          {progress != null ? `${progress}%` : "Sin entregables"}
        </span>
      </div>
      {progress != null ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
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
