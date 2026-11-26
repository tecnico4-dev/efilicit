"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatDateMadrid } from "@/lib/datetime";
import { OFFER_ACTION_ERROR } from "@/components/mis-licitaciones/offer-user-facing-error";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  asOfferGoDecision,
  setOfferCaseGoDecision,
} from "@/lib/queries";

function shortName(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "alguien";
  if (parts.length === 1) return parts[0]!;
  const last = parts[parts.length - 1]!;
  return `${parts[0]} ${last[0]!.toUpperCase()}.`;
}

function DecisionBadge({
  decision,
}: {
  decision: "go" | "no_go" | "pending";
}) {
  if (decision === "go") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/30 bg-emerald-600/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-emerald-800 dark:text-emerald-200">
        <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
        GO
      </span>
    );
  }
  if (decision === "no_go") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/35 bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-destructive">
        <span className="size-1.5 rounded-full bg-destructive" aria-hidden />
        NO-GO
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-amber-800 dark:text-amber-200">
      <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
      PENDIENTE
    </span>
  );
}

export function OfferGoDecisionCard({
  offerCaseId,
  userId,
  decision,
  reason,
  decidedAt,
  decidedByName,
}: {
  offerCaseId: string;
  userId: string;
  decision: string | null;
  reason: string | null;
  decidedAt: string | null;
  decidedByName: string | null;
}) {
  const router = useRouter();
  const parsed = asOfferGoDecision(decision);
  const decided = parsed === "go" || parsed === "no_go";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<"go" | "no_go">(
    parsed === "no_go" ? "no_go" : "go",
  );
  const [draftReason, setDraftReason] = useState(reason ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEditor() {
    setDraft(parsed === "no_go" ? "no_go" : "go");
    setDraftReason(reason ?? "");
    setError(null);
    setEditing(true);
  }

  async function onSave() {
    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const result = await setOfferCaseGoDecision(client, {
      offerCaseId,
      decision: draft,
      reason: draftReason.trim() || null,
      decidedBy: userId,
    });
    setPending(false);
    if (result.error) {
      setError(OFFER_ACTION_ERROR);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  const meta = decided
    ? `Registrada por ${shortName(decidedByName)} el ${formatDateMadrid(decidedAt)}`
    : "Aún no se ha registrado una decisión.";

  return (
    <div className="rounded-xl border border-border bg-muted/25 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">
            Decisión go / no-go
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">{meta}</p>
        </div>
        <DecisionBadge decision={decided ? parsed : "pending"} />
      </div>

      {editing ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDraft("go")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors",
                draft === "go"
                  ? "border-emerald-600/40 bg-emerald-600/15 text-emerald-900 dark:text-emerald-100"
                  : "border-border bg-surface text-muted-foreground hover:bg-muted",
              )}
            >
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
              GO
            </button>
            <button
              type="button"
              onClick={() => setDraft("no_go")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors",
                draft === "no_go"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-border bg-surface text-muted-foreground hover:bg-muted",
              )}
            >
              <span className="size-1.5 rounded-full bg-destructive" aria-hidden />
              NO-GO
            </button>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              Motivo / comentarios
            </span>
            <textarea
              value={draftReason}
              onChange={(e) => setDraftReason(e.target.value)}
              rows={3}
              placeholder="Por qué se decide presentar o no…"
              className="mt-1.5 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </label>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onSave}
              disabled={pending}
            >
              {pending ? "Guardando…" : "Guardar decisión"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-foreground">
            {decided ? (
              reason?.trim() ? (
                <span className="whitespace-pre-wrap">
                  «{reason.trim()}»
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Sin motivo registrado.
                </span>
              )
            ) : (
              <span className="text-muted-foreground">
                Valora si conviene presentarse a esta licitación antes de
                avanzar la preparación.
              </span>
            )}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openEditor}
            className="shrink-0"
          >
            {decided ? "Revisar decisión" : "Tomar decisión"}
          </Button>
        </div>
      )}
    </div>
  );
}
