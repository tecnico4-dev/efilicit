"use client";

import { Button } from "@/components/ui/button";
import { MarkAsPresentedConfirmModal } from "@/components/mis-licitaciones/mark-as-presented-confirm-modal";
import {
  type PresentationReqInput,
  type PresentationTaskInput,
} from "@/components/mis-licitaciones/mark-as-presented-readiness";
import { useMarkAsPresented } from "@/components/mis-licitaciones/use-mark-as-presented";

function StatusBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-amber-800 dark:text-amber-200">
      <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
      PENDIENTE
    </span>
  );
}

/**
 * Bloque de Resumen solo en En preparación (como «Pasar a análisis» en Interés).
 * Al marcar presentada desaparece al cambiar de etapa.
 */
export function OfferPresentedCard({
  offerCaseId,
  userId,
  requirements,
  tasks,
}: {
  offerCaseId: string;
  userId: string;
  requirements: PresentationReqInput[];
  tasks: PresentationTaskInput[];
}) {
  const {
    readiness,
    confirmOpen,
    pending,
    error,
    requestMark,
    confirmMark,
    cancelConfirm,
  } = useMarkAsPresented({ offerCaseId, userId, requirements, tasks });

  return (
    <div className="rounded-xl border border-border bg-muted/25 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">
            Presentación de la oferta
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Aún no se ha marcado la presentación de la oferta.
          </p>
        </div>
        <StatusBadge />
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm leading-relaxed text-muted-foreground">
          Cuando hayáis enviado la oferta en la plataforma oficial, márcalo
          aquí para pasar el expediente a{" "}
          <span className="font-semibold text-foreground">Presentada</span>.
        </p>
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
      </div>
      {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
      <MarkAsPresentedConfirmModal
        open={confirmOpen}
        busy={pending}
        readiness={readiness}
        onConfirm={confirmMark}
        onCancel={cancelConfirm}
      />
    </div>
  );
}
