"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatDateTimeMadrid } from "@/lib/datetime";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  requestOfferCaseIntake,
  type OfferCaseIntakeRow,
} from "@/lib/queries";

function describe(intake: OfferCaseIntakeRow | null): {
  text: string;
  detail?: string;
  tone: "muted" | "warn" | "bad" | "ok";
} {
  if (!intake) {
    return {
      text: "Aún no se ha extraído información automáticamente.",
      tone: "muted",
    };
  }
  if (intake.status === "pending") {
    return {
      text: "Esta licitación aún no se ha procesado para extraer su información automáticamente.",
      detail: `En espera desde el ${formatDateTimeMadrid(intake.requested_at)}. Se procesará en la próxima ejecución.`,
      tone: "warn",
    };
  }
  if (intake.status === "processing") {
    return { text: "Procesando la información…", tone: "warn" };
  }
  if (intake.status === "failed") {
    return {
      text: "No se pudo completar la extracción.",
      tone: "bad",
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
}: {
  offerCaseId: string;
  userId: string;
  intake: OfferCaseIntakeRow | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = intake?.status === "pending" || intake?.status === "processing";
  const status = describe(intake);

  async function onRequest() {
    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const result = await requestOfferCaseIntake(client, {
      offerCaseId,
      requestedBy: userId,
    });
    setPending(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
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
