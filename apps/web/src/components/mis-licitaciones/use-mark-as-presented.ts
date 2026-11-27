"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { OFFER_ACTION_ERROR } from "@/components/mis-licitaciones/offer-user-facing-error";
import {
  assessPresentationReadiness,
  type PresentationReqInput,
  type PresentationTaskInput,
} from "@/components/mis-licitaciones/mark-as-presented-readiness";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { markOfferCasePresented } from "@/lib/queries";

export function useMarkAsPresented({
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
  const router = useRouter();
  const readiness = useMemo(
    () => assessPresentationReadiness(requirements, tasks),
    [requirements, tasks],
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doMark() {
    if (pending) return;
    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const { error: err } = await markOfferCasePresented(client, {
      offerCaseId,
      createdBy: userId,
    });
    setPending(false);
    setConfirmOpen(false);
    if (err) {
      setError(OFFER_ACTION_ERROR);
      return;
    }
    router.refresh();
  }

  function requestMark() {
    if (pending) return;
    setError(null);
    if (readiness.ready) {
      void doMark();
      return;
    }
    setConfirmOpen(true);
  }

  return {
    readiness,
    confirmOpen,
    pending,
    error,
    requestMark,
    confirmMark: () => void doMark(),
    cancelConfirm: () => {
      if (!pending) setConfirmOpen(false);
    },
  };
}
