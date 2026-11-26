"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { applyStructuredOfferIntake } from "@/app/actions/offer-intake-structured";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatDateTimeMadrid } from "@/lib/datetime";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { OFFER_ACTION_ERROR } from "@/components/mis-licitaciones/offer-user-facing-error";
import {
  requestOfferCaseIntake,
  type OfferCaseIntakeRow,
} from "@/lib/queries";

function describe(
  intake: OfferCaseIntakeRow | null,
  hasStructuredData: boolean,
): {
  text: string;
  detail?: string;
  tone: "muted" | "warn" | "bad" | "ok";
} {
  if (!intake) {
    return {
      text: hasStructuredData
        ? "Datos del anuncio cargados. La descarga de pliegos se encolará al solicitar extracción."
        : "Aún no se ha extraído información automáticamente.",
      tone: hasStructuredData ? "ok" : "muted",
    };
  }
  if (intake.status === "pending") {
    if (hasStructuredData) {
      return {
        text: "Datos del anuncio cargados. Descarga de pliegos en cola.",
        detail: `En espera desde el ${formatDateTimeMadrid(intake.requested_at)}. El proceso automático completará los PDF cuando se ejecute (1–2 veces al día).`,
        tone: "ok",
      };
    }
    return {
      text: "Extracción automática en cola.",
      detail: `En espera desde el ${formatDateTimeMadrid(intake.requested_at)}.`,
      tone: "warn",
    };
  }
  if (intake.status === "processing") {
    return { text: "Procesando la información…", tone: "warn" };
  }
  if (intake.status === "failed") {
    return {
      text: hasStructuredData
        ? "Datos del anuncio cargados; falló la descarga de pliegos."
        : "No se pudo completar la extracción.",
      tone: hasStructuredData ? "warn" : "bad",
    };
  }
  const stats = (intake.stats ?? {}) as Record<string, unknown>;
  if (typeof stats.skipped === "string") {
    return {
      text: "La extracción automática solo está disponible para licitaciones de la Plataforma de Contratación del Sector Público.",
      tone: "muted",
    };
  }
  const when = intake.finished_at ? formatDateTimeMadrid(intake.finished_at) : "—";
  return { text: `Última extracción automática: ${when}.`, tone: "ok" };
}

export function OfferCaseIntakeStatus({
  offerCaseId,
  userId,
  intake,
  hasStructuredData = false,
}: {
  offerCaseId: string;
  userId: string;
  intake: OfferCaseIntakeRow | null;
  /** Ya hay filas offer_* del sync inmediato (requisitos/pliegos/…). */
  hasStructuredData?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = intake?.status === "pending" || intake?.status === "processing";
  const status = describe(intake, hasStructuredData);

  async function onRequest() {
    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const result = await requestOfferCaseIntake(client, {
      offerCaseId,
      requestedBy: userId,
    });
    if (result.error) {
      setPending(false);
      setError(OFFER_ACTION_ERROR);
      return;
    }
    await applyStructuredOfferIntake(offerCaseId);
    setPending(false);
    router.refresh();
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm",
        status.tone === "ok" && "border-emerald-300/60 bg-emerald-50/60",
        status.tone === "warn" && "border-amber-300/60 bg-amber-50/60",
        status.tone === "bad" && "border-destructive/40 bg-destructive/5",
        status.tone === "muted" && "border-border bg-muted/40",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-foreground">{status.text}</p>
        {status.detail ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{status.detail}</p>
        ) : null}
        {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onRequest}
        disabled={pending || open}
      >
        {open
          ? "En espera"
          : intake
            ? "Reprocesar información"
            : "Extraer información"}
      </Button>
    </div>
  );
}
