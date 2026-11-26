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
  tone: "muted" | "warn" | "bad" | "ok";
} {
  if (!intake) {
    return { text: "Aún no se ha extraído información del pliego.", tone: "muted" };
  }
  if (intake.status === "pending") {
    return {
      text: `En cola desde ${formatDateTimeMadrid(intake.requested_at)}. Se procesa en la próxima ejecución del intake.`,
      tone: "warn",
    };
  }
  if (intake.status === "processing") {
    return { text: "Procesando pliegos…", tone: "warn" };
  }
  if (intake.status === "failed") {
    return {
      text: `La última extracción falló${intake.last_error ? `: ${intake.last_error}` : "."}`,
      tone: "bad",
    };
  }
  const stats = (intake.stats ?? {}) as Record<string, unknown>;
  if (typeof stats.skipped === "string") {
    return {
      text: "Esta licitación no tiene datos PLACSP para extraer (solo se procesan fuentes PLACSP).",
      tone: "muted",
    };
  }
  const when = intake.finished_at ? formatDateTimeMadrid(intake.finished_at) : "—";
  return { text: `Última extracción del pliego PLACSP: ${when}.`, tone: "ok" };
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
        {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onRequest}
        disabled={pending || open}
      >
        {open ? "En cola" : intake ? "Reprocesar pliegos" : "Extraer del pliego"}
      </Button>
    </div>
  );
}
