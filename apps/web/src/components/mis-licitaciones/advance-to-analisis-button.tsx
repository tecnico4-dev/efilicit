"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { advanceOfferCaseToAnalisis } from "@/lib/queries";

export function AdvanceToAnalisisButton({
  offerCaseId,
}: {
  offerCaseId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAdvance() {
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

  return (
    <div className="rounded-xl border border-border bg-muted/25 p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-foreground">Interés</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Cuando quieras valorar si conviene presentarse, pasa el expediente a
        Análisis para registrar la decisión go / no-go.
      </p>
      {error ? (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      ) : null}
      <div className="mt-4">
        <Button
          type="button"
          size="sm"
          onClick={() => void onAdvance()}
          disabled={pending}
        >
          {pending ? "Pasando…" : "Pasar a análisis"}
        </Button>
      </div>
    </div>
  );
}
