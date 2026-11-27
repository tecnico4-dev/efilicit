"use client";

import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  presentationReadinessLines,
  type PresentationReadiness,
} from "@/components/mis-licitaciones/mark-as-presented-readiness";

export function MarkAsPresentedConfirmModal({
  open,
  busy,
  readiness,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  busy: boolean;
  readiness: PresentationReadiness;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (typeof document === "undefined" || !open) return null;

  const lines = presentationReadinessLines(readiness);

  return createPortal(
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-3"
      role="presentation"
      onClick={busy ? undefined : onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mark-presented-title"
        className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="mark-presented-title"
          className="text-base font-semibold text-foreground"
        >
          ¿Seguro que quieres marcar como presentada?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          El expediente aún no cumple las comprobaciones habituales antes de
          presentar:
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-foreground">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={onCancel}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Marcando…" : "Marcar de todas formas"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
