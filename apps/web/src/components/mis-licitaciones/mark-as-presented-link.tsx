"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OFFER_ACTION_ERROR } from "@/components/mis-licitaciones/offer-user-facing-error";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { markOfferCasePresented } from "@/lib/queries";

/** CTA compacto bajo el KPI Estado (cabecera) en En preparación. */
export function MarkAsPresentedLink({
  offerCaseId,
  userId,
}: {
  offerCaseId: string;
  userId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mark() {
    if (pending) return;
    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const { error: err } = await markOfferCasePresented(client, {
      offerCaseId,
      createdBy: userId,
    });
    setPending(false);
    if (err) {
      setError(OFFER_ACTION_ERROR);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => void mark()}
        disabled={pending}
        className="text-left text-xs font-medium text-primary hover:underline disabled:opacity-60"
      >
        {pending ? "Marcando…" : "Marcar como presentada →"}
      </button>
      {error ? (
        <p className="mt-0.5 text-[0.65rem] leading-snug text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
