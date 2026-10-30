import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getSessionProfile,
  getSupabaseServerClient,
} from "@/lib/auth/session";
import {
  getBidCaseById,
  listBidDocuments,
} from "@/lib/queries";
import { formatCountdown } from "@/lib/bid-countdown";
import { formatDateMadrid, formatDateTimeMadrid } from "@/lib/datetime";
import { formatTenderStatus } from "@/lib/tender-labels";
import {
  PAGE_MAIN_CLASS,
  PAGE_TITLE_RULE,
} from "@/components/shell/page-width";
import { ErrorState } from "@/components/ui/state-message";
import { CaseStageBadge } from "@/components/my-tenders/case-stage-badge";
import {
  CaseMetaForm,
  ChecklistPanel,
  DocumentsPanel,
  UpdatesPanel,
} from "@/components/my-tenders/case-detail-panels";
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

export default async function MyTenderDetailPage({ params }: PageProps) {
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

  const tender = bidCase.tenders;
  const due =
    bidCase.checklist.find((c) => !c.done_at && c.due_at)?.due_at ??
    tender?.deadline_at ??
    null;
  const cd = formatCountdown(due);

  return (
    <main className={PAGE_MAIN_CLASS}>
      <p className="text-sm">
        <Link
          href="/my-tenders"
          className="font-medium text-link hover:underline"
        >
          ← Mis licitaciones
        </Link>
      </p>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
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
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {tender?.title ?? "Licitación eliminada"}
          </h1>
          {tender ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {formatMoney(tender.estimated_value, tender.currency)}
              {tender.status
                ? ` · ${formatTenderStatus(tender.status)}`
                : null}
              {tender.deadline_at
                ? ` · Plazo oferta ${formatDateTimeMadrid(tender.deadline_at)}`
                : null}
            </p>
          ) : null}
        </div>
        {tender ? (
          <Link
            href={`/tenders/${tender.id}?from=my-tenders`}
            className="text-sm font-medium text-link hover:underline"
          >
            Ver ficha pública →
          </Link>
        ) : null}
      </div>

      <div className={cn(PAGE_TITLE_RULE, "space-y-10")}>
        <section>
          <h2 className="text-base font-semibold text-foreground">
            Expediente
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Responsable, fechas y etapa del proceso de presentación.
          </p>
          <div className="mt-4">
            <CaseMetaForm
              caseId={bidCase.id}
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
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">
            Checklist de requisitos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Marca lo entregado y pon plazos; la cuenta atrás aparece en la
            lista.
          </p>
          <div className="mt-4">
            <ChecklistPanel caseId={bidCase.id} items={bidCase.checklist} />
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">
            Novedades publicadas
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Q&A, ampliaciones de plazo, requerimientos… lo que afecte a la
            oferta.
          </p>
          <div className="mt-4">
            <UpdatesPanel
              caseId={bidCase.id}
              userId={profile.data.id}
              updates={bidCase.updates}
            />
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">
            Documentación
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Enlaces a Drive/SharePoint con tags para reutilizar en licitaciones
            parecidas. Creado:{" "}
            {formatDateMadrid(bidCase.created_at)}.
          </p>
          <div className="mt-4">
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
        </section>
      </div>
    </main>
  );
}
