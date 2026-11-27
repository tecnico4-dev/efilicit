"use client";

import { MarkAsPresentedConfirmModal } from "@/components/mis-licitaciones/mark-as-presented-confirm-modal";
import {
  type PresentationReqInput,
  type PresentationTaskInput,
} from "@/components/mis-licitaciones/mark-as-presented-readiness";
import { useMarkAsPresented } from "@/components/mis-licitaciones/use-mark-as-presented";

/** CTA compacto bajo el KPI Estado (cabecera) en En preparación. */
export function MarkAsPresentedLink({
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
    <div className="mt-1.5">
      <button
        type="button"
        onClick={requestMark}
        disabled={pending}
        className="text-left text-xs font-medium text-primary hover:underline disabled:opacity-60"
      >
        {pending && !confirmOpen ? "Marcando…" : "Marcar como presentada →"}
      </button>
      {error ? (
        <p className="mt-0.5 text-[0.65rem] leading-snug text-destructive">
          {error}
        </p>
      ) : null}
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
