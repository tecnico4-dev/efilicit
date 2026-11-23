"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { calendarDayMadrid, formatDateMadrid } from "@/lib/datetime";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { AnchoredPortal } from "@/components/ui/anchored-portal";
import {
  ENVELOPE_LABELS,
  REQUIREMENT_CATEGORY_LABELS,
} from "@/components/mis-licitaciones/offer-case-sections";
import { SingleDatePicker } from "@/components/mis-licitaciones/single-date-picker";
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

const TYPE_CLASS: Record<string, string> = {
  excluyente: "text-destructive",
  puntuable: "text-amber-700",
  informativo: "text-muted-foreground",
};

type ChipTone = "ok" | "warn" | "bad" | "muted" | "blue" | "purple" | "dim";

const chipClass: Record<ChipTone, string> = {
  ok: "border-emerald-300/60 bg-emerald-50 text-emerald-900",
  warn: "border-amber-300/60 bg-amber-50 text-amber-900",
  bad: "border-destructive/40 bg-destructive/10 text-destructive",
  muted: "border-border bg-muted text-muted-foreground",
  dim: "border-border/70 bg-muted/50 text-muted-foreground/80",
  blue: "border-sky-300/60 bg-sky-50 text-sky-900",
  purple: "border-violet-300/60 bg-violet-50 text-violet-900",
};

function complianceTone(status: string): ChipTone {
  if (status === "cumple") return "ok";
  if (status === "no_cumple") return "bad";
  if (status === "sin_verificar" || status === "parcial") return "warn";
  return "muted";
}

function prepTone(status: string): ChipTone {
  if (status === "listo") return "ok";
  if (status === "en_curso") return "blue";
  if (status === "en_revision") return "purple";
  if (status === "bloqueado") return "bad";
  return "dim"; // pendiente
}

function dueToneClass(dueIso: string | null): string {
  if (!dueIso) return "text-muted-foreground";
  const due = new Date(dueIso).getTime();
  if (Number.isNaN(due)) return "text-muted-foreground";
  const diff = due - Date.now();
  if (diff < 0) return "text-destructive";
  if (diff < 3 * 86_400_000) return "text-amber-700";
  return "text-muted-foreground";
}

/** «Ana García López» → «Ana G.» */
function shortMemberName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0]!;
  const first = parts[0]!;
  const lastInitial = parts[1]!.charAt(0).toUpperCase();
  return `${first} ${lastInitial}.`;
}

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
      className={cn("size-3.5 shrink-0", className)}
    >
      <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path
        fillRule="evenodd"
        d="M10 11c-3.3 0-6 1.8-6 4v.5c0 .3.2.5.5.5h11c.3 0 .5-.2.5-.5V15c0-2.2-2.7-4-6-4Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

/** Avatar del directorio: foto o círculo con iniciales. */
function MemberAvatar({
  name,
  avatarUrl,
  className,
  muted,
}: {
  name: string;
  avatarUrl: string | null;
  className?: string;
  muted?: boolean;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className={cn(
          "size-4 shrink-0 rounded-full object-cover",
          muted && "opacity-50",
          className,
        )}
      />
    );
  }
  return (
    <span
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-full",
        "bg-muted text-[0.55rem] font-semibold leading-none text-foreground",
        muted && "bg-muted/60 text-muted-foreground/50",
        className,
      )}
      aria-hidden
    >
      {memberInitials(name)}
    </span>
  );
}

function EditableChipSelect({
  value,
  options,
  tone,
  disabled,
  locked,
  ariaLabel,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  tone: ChipTone;
  disabled?: boolean;
  /** Solo lectura visual (p. ej. fila en «No aplica»). */
  locked?: boolean;
  ariaLabel: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const label = options.find((o) => o.value === value)?.label ?? value;
  const inert = Boolean(disabled || locked);

  return (
    <div className="relative flex justify-center">
      <button
        ref={triggerRef}
        type="button"
        disabled={inert}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => !inert && setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center justify-center rounded-full border px-3 py-1.5",
          "text-center text-xs font-semibold leading-none outline-none",
          "focus-visible:ring-2 focus-visible:ring-primary/40",
          locked
            ? "cursor-default border-border/40 bg-muted/40 text-muted-foreground/50"
            : cn(
                "cursor-pointer",
                chipClass[tone],
                disabled && "cursor-wait opacity-60",
              ),
        )}
      >
        {label}
      </button>

      <AnchoredPortal
        open={open && !inert}
        anchorRef={triggerRef}
        onDismiss={() => setOpen(false)}
        matchAnchorWidth={false}
        align="center"
        minWidth={140}
        maxWidth={200}
        maxHeight={260}
        className="bg-background p-1"
      >
        <ul role="listbox" className="py-0.5">
          {options.map((opt) => {
            const selected = opt.value === value;
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={cn(
                    "flex w-full items-center justify-center rounded-md px-2.5 py-1.5 text-center text-sm",
                    "hover:bg-muted",
                    selected
                      ? "font-semibold text-foreground"
                      : "text-foreground",
                  )}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              </li>
            );
          })}
        </ul>
      </AnchoredPortal>
    </div>
  );
}

function MemberPicker({
  value,
  members,
  disabled,
  locked,
  onChange,
}: {
  value: string | null;
  members: EficenMemberForTeam[];
  disabled?: boolean;
  locked?: boolean;
  onChange: (next: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = members.find((m) => m.id === value) ?? null;
  const inert = Boolean(disabled || locked);

  return (
    <div className="relative flex justify-center">
      <button
        ref={triggerRef}
        type="button"
        disabled={inert}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => !inert && setOpen((v) => !v)}
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 rounded-sm text-left text-xs font-medium",
          "outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          locked
            ? "cursor-default text-muted-foreground/45"
            : cn(
                "hover:underline",
                disabled && "cursor-wait opacity-60 no-underline",
                selected ? "text-foreground" : "text-muted-foreground",
              ),
        )}
      >
        {selected ? (
          <MemberAvatar
            name={selected.displayName}
            avatarUrl={selected.avatarUrl}
            muted={locked}
          />
        ) : (
          <PersonIcon
            className={
              locked ? "text-muted-foreground/45" : "text-muted-foreground"
            }
          />
        )}
        <span className="truncate">
          {selected ? shortMemberName(selected.displayName) : "Sin asignar"}
        </span>
      </button>

      <AnchoredPortal
        open={open && !inert}
        anchorRef={triggerRef}
        onDismiss={() => setOpen(false)}
        matchAnchorWidth={false}
        align="center"
        minWidth={200}
        maxWidth={280}
        maxHeight={260}
        className="bg-background p-1"
      >
        <ul role="listbox" className="py-0.5">
          <li>
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              <PersonIcon />
              Sin asignar
            </button>
          </li>
          {members.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                role="option"
                aria-selected={m.id === value}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-muted",
                  m.id === value
                    ? "font-semibold text-foreground"
                    : "text-foreground",
                )}
                onClick={() => {
                  onChange(m.id);
                  setOpen(false);
                }}
              >
                <MemberAvatar
                  name={m.displayName}
                  avatarUrl={m.avatarUrl}
                  className="size-5 text-[0.6rem]"
                />
                <span className="truncate">{m.displayName}</span>
              </button>
            </li>
          ))}
        </ul>
      </AnchoredPortal>
    </div>
  );
}

const thCenter =
  "px-2 py-2 text-center font-semibold whitespace-nowrap";
const tdCenter = "px-2 py-3 text-center align-middle";

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

  return (
    <div className="space-y-2">
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[48%]" />
            <col className="w-[9%]" />
            <col className="w-[11%]" />
            <col className="w-[12%]" />
            <col className="w-[11%]" />
            <col className="w-[9%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border text-[0.7rem] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 text-left font-semibold">Requisito</th>
              <th className={thCenter}>Tipo</th>
              <th className={thCenter}>¿Cumplimos?</th>
              <th className={thCenter}>Preparación</th>
              <th className={thCenter}>Responsable</th>
              <th className={thCenter}>Fecha interna</th>
            </tr>
          </thead>
          <tbody>
            {requirements.map((item) => {
              const busy = pendingId === item.id;
              const naLocked = item.compliance_status === "no_aplica";
              const dueDay = item.internal_due_at
                ? calendarDayMadrid(item.internal_due_at)
                : null;
              return (
                <tr key={item.id} className="border-b border-border/80">
                  <td
                    className={cn(
                      "px-3 py-3 align-middle font-medium",
                      naLocked ? "text-muted-foreground/55" : "text-foreground",
                    )}
                  >
                    <p className="line-clamp-2 leading-snug">{item.title}</p>
                    <p
                      className={cn(
                        "mt-0.5 line-clamp-2 text-xs font-normal",
                        naLocked
                          ? "text-muted-foreground/45"
                          : "text-muted-foreground",
                      )}
                    >
                      {[
                        REQUIREMENT_CATEGORY_LABELS[item.category] ??
                          item.category,
                        item.envelope
                          ? (ENVELOPE_LABELS[item.envelope] ?? item.envelope)
                          : null,
                        item.required_value,
                        item.source_kind === "legacy_checklist"
                          ? "legacy"
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      {item.source_kind === "pliego_xml" ? (
                        <span
                          className={cn(
                            "ml-1.5 inline-flex rounded border px-1 text-[0.65rem] font-semibold",
                            naLocked
                              ? "border-border/40 bg-muted/40 text-muted-foreground/50"
                              : "border-primary/30 bg-primary/5 text-primary",
                          )}
                        >
                          Pliego
                        </span>
                      ) : null}
                    </p>
                  </td>
                  <td className={tdCenter}>
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        naLocked
                          ? "text-muted-foreground/45"
                          : (TYPE_CLASS[item.requirement_type] ??
                            "text-muted-foreground"),
                      )}
                    >
                      {TYPE_LABELS[item.requirement_type] ??
                        item.requirement_type}
                    </span>
                  </td>
                  <td className={tdCenter}>
                    <EditableChipSelect
                      value={item.compliance_status}
                      disabled={busy}
                      tone={complianceTone(item.compliance_status)}
                      ariaLabel="Cumplimiento"
                      options={OFFER_COMPLIANCE_STATUSES.map((s) => ({
                        value: s,
                        label: OFFER_COMPLIANCE_LABELS[s],
                      }))}
                      onChange={(v) => {
                        const compliance = v as OfferComplianceStatus;
                        void patch(item.id, {
                          compliance_status: compliance,
                          ...(compliance === "cumple"
                            ? { prep_status: "listo" as const }
                            : {}),
                        });
                      }}
                    />
                  </td>
                  <td className={tdCenter}>
                    <EditableChipSelect
                      value={item.prep_status}
                      disabled={busy}
                      locked={naLocked}
                      tone={prepTone(item.prep_status)}
                      ariaLabel="Preparación"
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
                  <td className={tdCenter}>
                    <MemberPicker
                      value={item.owner_member_id}
                      members={members}
                      disabled={busy}
                      locked={naLocked}
                      onChange={(v) =>
                        void patch(item.id, { owner_member_id: v })
                      }
                    />
                  </td>
                  <td className={tdCenter}>
                    <SingleDatePicker
                      value={dueDay}
                      disabled={busy}
                      locked={naLocked}
                      toneClassName={
                        item.compliance_status === "cumple"
                          ? "text-muted-foreground"
                          : dueToneClass(item.internal_due_at)
                      }
                      onChange={(day) =>
                        void patch(item.id, {
                          internal_due_at: day
                            ? `${day}T12:00:00.000Z`
                            : null,
                        })
                      }
                    />
                    <span className="sr-only">
                      {item.internal_due_at
                        ? formatDateMadrid(item.internal_due_at)
                        : "Sin fecha"}
                    </span>
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
