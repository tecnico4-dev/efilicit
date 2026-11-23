"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { calendarDayMadrid } from "@/lib/datetime";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  ENVELOPE_LABELS,
  REQUIREMENT_CATEGORY_LABELS,
} from "@/components/mis-licitaciones/offer-case-sections";
import {
  OFFER_COMPLIANCE_LABELS,
  OFFER_COMPLIANCE_STATUSES,
  OFFER_PREP_LABELS,
  OFFER_PREP_STATUSES,
  updateOfferRequirement,
  type EficenMemberForTeam,
  type OfferComplianceStatus,
  type OfferPrepStatus,
  type OfferRequirementDetail,
} from "@/lib/queries";

const TYPE_LABELS: Record<string, string> = {
  excluyente: "Excluyente",
  puntuable: "Puntuable",
  informativo: "Informativo",
};

function complianceTone(status: string): "ok" | "warn" | "bad" | "muted" {
  if (status === "cumple") return "ok";
  if (status === "no_cumple") return "bad";
  if (status === "sin_verificar" || status === "parcial") return "warn";
  return "muted";
}

function prepTone(status: string): "ok" | "warn" {
  return status === "listo" ? "ok" : "warn";
}

const toneClass: Record<"ok" | "warn" | "bad" | "muted", string> = {
  ok: "border-emerald-300/60 bg-emerald-50 text-emerald-900",
  warn: "border-amber-300/60 bg-amber-50 text-amber-900",
  bad: "border-destructive/40 bg-destructive/10 text-destructive",
  muted: "border-border bg-muted text-muted-foreground",
};

function EditableSelect({
  value,
  options,
  tone,
  disabled,
  emptyLabel,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  tone: "ok" | "warn" | "bad" | "muted";
  disabled?: boolean;
  emptyLabel?: string;
  onChange: (next: string) => void;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "max-w-full cursor-pointer appearance-none rounded-full border px-2 py-0.5 text-xs font-semibold outline-none",
        "focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-wait disabled:opacity-60",
        toneClass[tone],
      )}
      aria-label={emptyLabel}
    >
      {emptyLabel ? <option value="">{emptyLabel}</option> : null}
      {options.map((opt) => (
        <option key={opt.value || "empty"} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function OfferRequirementsTable({
  requirements,
  members,
}: {
  requirements: OfferRequirementDetail[];
  members: EficenMemberForTeam[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function patch(
    id: string,
    next: Parameters<typeof updateOfferRequirement>[1]["patch"],
  ) {
    setError(null);
    setPendingId(id);
    const client = createSupabaseBrowserClient();
    const result = await updateOfferRequirement(client, { id, patch: next });
    setPendingId(null);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    startTransition(() => router.refresh());
  }

  const memberOptions = members.map((m) => ({
    value: m.id,
    label: m.displayName,
  }));

  return (
    <div className="space-y-2">
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[0.7rem] uppercase tracking-wide text-muted-foreground">
              <th className="px-2 py-2 font-semibold">Requisito</th>
              <th className="px-2 py-2 font-semibold">Tipo</th>
              <th className="px-2 py-2 font-semibold">¿Cumplimos?</th>
              <th className="px-2 py-2 font-semibold">Preparación</th>
              <th className="px-2 py-2 font-semibold">Fecha interna</th>
              <th className="px-2 py-2 font-semibold">Responsable</th>
            </tr>
          </thead>
          <tbody>
            {requirements.map((item) => {
              const busy = pendingId === item.id;
              const dueDay = item.internal_due_at
                ? calendarDayMadrid(item.internal_due_at)
                : null;
              return (
                <tr key={item.id} className="border-b border-border/80">
                  <td className="px-2 py-2.5 font-medium text-foreground">
                    {item.title}
                    <p className="text-xs font-normal text-muted-foreground">
                      {[
                        REQUIREMENT_CATEGORY_LABELS[item.category] ??
                          item.category,
                        item.envelope
                          ? (ENVELOPE_LABELS[item.envelope] ?? item.envelope)
                          : null,
                        item.required_value,
                        item.source_kind === "legacy_checklist" ? "legacy" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      {item.source_kind === "pliego_xml" ? (
                        <span className="ml-1.5 inline-flex rounded border border-primary/30 bg-primary/5 px-1 text-[0.65rem] font-semibold text-primary">
                          Pliego
                        </span>
                      ) : null}
                    </p>
                  </td>
                  <td className="px-2 py-2.5 text-muted-foreground">
                    {TYPE_LABELS[item.requirement_type] ?? item.requirement_type}
                  </td>
                  <td className="px-2 py-2.5">
                    <EditableSelect
                      value={item.compliance_status}
                      disabled={busy}
                      tone={complianceTone(item.compliance_status)}
                      options={OFFER_COMPLIANCE_STATUSES.map((s) => ({
                        value: s,
                        label: OFFER_COMPLIANCE_LABELS[s],
                      }))}
                      onChange={(v) =>
                        void patch(item.id, {
                          compliance_status: v as OfferComplianceStatus,
                        })
                      }
                    />
                  </td>
                  <td className="px-2 py-2.5">
                    <EditableSelect
                      value={item.prep_status}
                      disabled={busy}
                      tone={prepTone(item.prep_status)}
                      options={OFFER_PREP_STATUSES.map((s) => ({
                        value: s,
                        label: OFFER_PREP_LABELS[s],
                      }))}
                      onChange={(v) =>
                        void patch(item.id, {
                          prep_status: v as OfferPrepStatus,
                        })
                      }
                    />
                  </td>
                  <td className="px-2 py-2.5">
                    <input
                      type="date"
                      value={dueDay ?? ""}
                      disabled={busy}
                      onChange={(e) => {
                        const day = e.target.value;
                        void patch(item.id, {
                          internal_due_at: day ? `${day}T12:00:00.000Z` : null,
                        });
                      }}
                      className={cn(
                        "rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground",
                        "outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        "disabled:cursor-wait disabled:opacity-60",
                      )}
                      aria-label="Fecha interna"
                    />
                  </td>
                  <td className="px-2 py-2.5">
                    <EditableSelect
                      value={item.owner_member_id ?? ""}
                      disabled={busy}
                      tone="muted"
                      emptyLabel="Sin asignar"
                      options={memberOptions}
                      onChange={(v) =>
                        void patch(item.id, {
                          owner_member_id: v ? v : null,
                        })
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
