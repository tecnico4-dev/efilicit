"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createBidCase } from "@/lib/queries";

/**
 * Añade la licitación al pipeline compartido (Mis licitaciones).
 * Si ya existe, enlaza al expediente.
 */
export function BidCaseToggle({
  userId,
  displayName,
  tenderId,
  existingCaseId,
}: {
  userId: string;
  displayName: string | null;
  tenderId: string;
  existingCaseId: string | null;
}) {
  const router = useRouter();
  const [caseId, setCaseId] = useState(existingCaseId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAdd() {
    if (caseId) {
      router.push(`/my-tenders/${caseId}`);
      return;
    }
    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const { data, error: createError } = await createBidCase(client, {
      tenderId,
      createdBy: userId,
      ownerName: displayName?.trim() || null,
      withDefaultChecklist: true,
    });
    setPending(false);
    if (createError || !data) {
      setError(createError?.message ?? "No se pudo crear el expediente");
      return;
    }
    setCaseId(data.id);
    router.push(`/my-tenders/${data.id}`);
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
