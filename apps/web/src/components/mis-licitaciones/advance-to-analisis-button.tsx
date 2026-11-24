"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { advanceOfferCaseToAnalisis } from "@/lib/queries";

function useAdvanceToAnalisis(offerCaseId: string) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function advance() {
    if (pending) return;
    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const { error: err } = await advanceOfferCaseToAnalisis(
      client,
      offerCaseId,
    );
    setPending(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.refresh();
  }

  return { pending, error, advance };
}

/** CTA compacto bajo el KPI Estado (cabecera). */
export function AdvanceToAnalisisLink({
  offerCaseId,
}: {
  offerCaseId: string;
}) {
  const { pending, error, advance } = useAdvanceToAnalisis(offerCaseId);

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => void advance()}
        disabled={pending}
        className="text-left text-xs font-medium text-primary hover:underline disabled:opacity-60"
      >
        {pending ? "Pasando…" : "Pasar a análisis →"}
      </button>
      {error ? (
        <p className="mt-0.5 text-[0.65rem] leading-snug text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Bloque en Resumen mientras el expediente está en Interés. */
export function AdvanceToAnalisisButton({
  offerCaseId,
}: {
  offerCaseId: string;
}) {
  const { pending, error, advance } = useAdvanceToAnalisis(offerCaseId);

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-primary">
            Etapa actual
          </p>
          <h3 className="mt-1 text-base font-semibold text-foreground">
            Interés
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            El expediente está aparcado aquí hasta que alguien empiece a
            valorarlo. En cuanto podáis mirarlo, pasadlo a{" "}
            <span className="font-medium text-foreground">Análisis</span> para
            decidir GO / NO-GO.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => void advance()}
          disabled={pending}
          className="shrink-0"
        >
          {pending ? "Pasando…" : "Pasar a análisis"}
        </Button>
      </div>
      {error ? (
        <p className="mt-3 text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
