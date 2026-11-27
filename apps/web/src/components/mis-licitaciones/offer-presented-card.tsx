"use client";

import { Button } from "@/components/ui/button";
import { formatDateMadrid } from "@/lib/datetime";
import { MarkAsPresentedConfirmModal } from "@/components/mis-licitaciones/mark-as-presented-confirm-modal";
import {
  type PresentationReqInput,
  type PresentationTaskInput,
} from "@/components/mis-licitaciones/mark-as-presented-readiness";
import { useMarkAsPresented } from "@/components/mis-licitaciones/use-mark-as-presented";

function StatusBadge({ presented }: { presented: boolean }) {
  if (presented) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/30 bg-emerald-600/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-emerald-800 dark:text-emerald-200">
        <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
        PRESENTADA
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-amber-800 dark:text-amber-200">
      <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
      PENDIENTE
    </span>
  );
}

/**
 * Constancia de presentación en Resumen (estilo GO/NO-GO).
 * Acción solo en En preparación; después queda en solo lectura.
 */
export function OfferPresentedCard({
  offerCaseId,
  userId,
  stage,
  presentedOn,
  requirements,
  tasks,
  readOnly = false,
}: {
  offerCaseId: string;
  userId: string;
  stage: string;
  presentedOn: string | null;
  requirements: PresentationReqInput[];
  tasks: PresentationTaskInput[];
  readOnly?: boolean;
}) {
  const canMark = stage === "preparacion" && !readOnly;
  const presented =
    Boolean(presentedOn) ||
    stage === "presentada" ||
    stage === "requerimiento";
  const {
    readiness,
    confirmOpen,
    pending,
    error,
    requestMark,
    confirmMark,
    cancelConfirm,
  } = useMarkAsPresented({ offerCaseId, userId, requirements, tasks });

  const meta = presented
    ? presentedOn
      ? `Registrada el ${formatDateMadrid(presentedOn)}`
      : "Oferta marcada como presentada."
    : "Aún no se ha marcado la presentación de la oferta.";

  return (
    <div className="rounded-xl border border-border bg-muted/25 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">
            Presentación de la oferta
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">{meta}</p>
        </div>
        <StatusBadge presented={presented} />
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm leading-relaxed text-muted-foreground">
          {presented ? (
            <span className="text-foreground">
              El expediente pasó a etapa Presentada. La oferta queda a la espera
              del órgano de contratación (o de un requerimiento).
            </span>
          ) : (
            <>
              Cuando hayáis enviado la oferta en la plataforma oficial, márcalo
              aquí para pasar el expediente a{" "}
              <span className="font-semibold text-foreground">Presentada</span>.
            </>
          )}
        </p>
        {canMark ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={requestMark}
            disabled={pending}
            className="shrink-0"
          >
            {pending && !confirmOpen ? "Marcando…" : "Marcar como presentada"}
          </Button>
        ) : null}
      </div>
      {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
      {canMark ? (
        <MarkAsPresentedConfirmModal
          open={confirmOpen}
          busy={pending}
          readiness={readiness}
          onConfirm={confirmMark}
          onCancel={cancelConfirm}
        />
      ) : null}
    </div>
  );
}
