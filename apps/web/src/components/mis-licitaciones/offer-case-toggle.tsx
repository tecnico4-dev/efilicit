"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { OFFER_ACTION_ERROR } from "@/components/mis-licitaciones/offer-user-facing-error";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  createOfferCase,
  type FavoriteKind,
  type OfferCaseKind,
} from "@/lib/queries";

/**
 * Añade la licitación al pipeline de oferta (Mis licitaciones / offer_cases).
 * Si ya existe, enlaza al expediente.
 * `kind` debería venir del favorito/interés; si falta → propia (Eficen).
 */
export function OfferCaseToggle({
  userId,
  tenderId,
  existingCaseId,
  kind = null,
}: {
  userId: string;
  tenderId: string;
  existingCaseId: string | null;
  kind?: FavoriteKind | OfferCaseKind | null;
}) {
  const router = useRouter();
  const [caseId, setCaseId] = useState(existingCaseId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAdd() {
    if (caseId) {
      router.push(`/mis-licitaciones/${caseId}`);
      return;
    }
    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const { data, error: createError } = await createOfferCase(client, {
      tenderId,
      createdBy: userId,
      kind,
    });
    setPending(false);
    if (createError || !data) {
      setError(OFFER_ACTION_ERROR);
      return;
    }
    setCaseId(data.id);
    router.push(`/mis-licitaciones/${data.id}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant={caseId ? "outline" : "primary"}
        size="sm"
        disabled={pending}
        onClick={onAdd}
      >
        {pending
          ? "…"
          : caseId
            ? "Ver en Mis licitaciones"
            : "Añadir a Mis licitaciones"}
      </Button>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
