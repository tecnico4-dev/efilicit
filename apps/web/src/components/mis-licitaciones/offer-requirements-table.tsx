"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { calendarDayMadrid, formatDateMadrid } from "@/lib/datetime";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { AnchoredPortal } from "@/components/ui/anchored-portal";
import { Button } from "@/components/ui/button";
import {
  ENVELOPE_LABELS,
  REQUIREMENT_CATEGORY_LABELS,
} from "@/components/mis-licitaciones/offer-case-sections";
import { useDetailTabsLeaveGuard } from "@/components/mis-licitaciones/detail-tabs";
import {
  EMPTY_OFFER_REQUIREMENTS_FILTERS,
  OWNER_UNASSIGNED,
  OfferRequirementsFiltersModal,
  countOfferRequirementsFilters,
  type OfferRequirementsFilters,
} from "@/components/mis-licitaciones/offer-requirements-filters-modal";
import {
  OfferRequirementsCreateModal,
  type OfferRequirementCreateValues,
} from "@/components/mis-licitaciones/offer-requirements-create-modal";
import { SingleDatePicker } from "@/components/mis-licitaciones/single-date-picker";
import {
  OFFER_COMPLIANCE_LABELS,
  OFFER_COMPLIANCE_STATUSES,
  OFFER_ENVELOPES,
  OFFER_PREP_LABELS,
  OFFER_PREP_STATUSES,
  OFFER_REQUIREMENT_TYPES,
  createOfferRequirement,
  deleteOfferRequirements,
  updateOfferRequirement,
  type EficenMemberForTeam,
  type OfferComplianceStatus,
  type OfferEnvelope,
  type OfferPrepStatus,
  type OfferRequirementDetail,
  type OfferRequirementType,
} from "@/lib/queries";
import { useUnsavedNavigationGuard } from "@/lib/use-unsaved-navigation-guard";

function envelopeLabel(value: OfferEnvelope | string): string {
  if (value === "ninguno") return "—";
  return ENVELOPE_LABELS[value] ?? value;
}

const ENVELOPE_OPTIONS = OFFER_ENVELOPES.map((value) => ({
  value,
  label: envelopeLabel(value),
}));

function normalizeEnvelope(value: string | null | undefined): OfferEnvelope {
  if (value && (OFFER_ENVELOPES as readonly string[]).includes(value)) {
    return value as OfferEnvelope;
  }
  return "ninguno";
}

/** Tipo en texto coloreado; menú solo en edición. */
function TypeTextSelect({
  value,
  disabled,
  locked,
  readOnly,
  alignStart,
  onChange,
}: {
  value: OfferRequirementType;
  disabled?: boolean;
  locked?: boolean;
  readOnly?: boolean;
  alignStart?: boolean;
  onChange: (next: OfferRequirementType) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inert = Boolean(disabled || locked || readOnly);
  const label = TYPE_LABELS[value] ?? value;

  return (
    <div
      className={cn(
        "relative flex",
        alignStart ? "justify-start" : "justify-center",
      )}
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={Boolean(disabled || locked)}
        aria-disabled={inert}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Tipo"
        onClick={() => !inert && setOpen((v) => !v)}
        className={cn(
          "rounded-sm text-xs font-semibold outline-none",
          "focus-visible:ring-2 focus-visible:ring-primary/40",
          locked
            ? "cursor-default text-muted-foreground/45"
            : cn(
                TYPE_CLASS[value] ?? "text-muted-foreground",
                readOnly ? "cursor-default" : "cursor-pointer hover:underline",
                disabled && "cursor-wait opacity-60 no-underline",
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
          {TYPE_OPTIONS.map((opt) => {
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
                  <span className={TYPE_CLASS[opt.value]}>{opt.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </AnchoredPortal>
    </div>
  );
}

/** Sobre en texto gris (sin chip); menú solo en edición. */
function EnvelopeTextSelect({
  value,
  disabled,
  locked,
  readOnly,
  alignStart,
  onChange,
}: {
  value: OfferEnvelope;
  disabled?: boolean;
  locked?: boolean;
  readOnly?: boolean;
  alignStart?: boolean;
  onChange: (next: OfferEnvelope) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inert = Boolean(disabled || locked || readOnly);
  const label = envelopeLabel(value);

  return (
    <div
      className={cn(
        "relative flex",
        alignStart ? "justify-start" : "justify-center",
      )}
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={Boolean(disabled || locked)}
        aria-disabled={inert}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Sobre"
        onClick={() => !inert && setOpen((v) => !v)}
        className={cn(
          "rounded-sm text-xs font-medium outline-none",
          "focus-visible:ring-2 focus-visible:ring-primary/40",
          locked
            ? "cursor-default text-muted-foreground/45"
            : cn(
                "text-muted-foreground",
                readOnly ? "cursor-default" : "cursor-pointer hover:underline",
                disabled && "cursor-wait opacity-60 no-underline",
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
          {ENVELOPE_OPTIONS.map((opt) => {
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

type ReqDraft = {
  compliance_status: OfferComplianceStatus;
  prep_status: OfferPrepStatus;
  requirement_type: OfferRequirementType;
  envelope: OfferEnvelope;
  owner_member_id: string | null;
  internal_due_at: string | null;
};

function snapshotReq(item: OfferRequirementDetail): ReqDraft {
  return {
    compliance_status: item.compliance_status as OfferComplianceStatus,
    prep_status: item.prep_status as OfferPrepStatus,
    requirement_type: item.requirement_type as OfferRequirementType,
    envelope: normalizeEnvelope(item.envelope),
    owner_member_id: item.owner_member_id,
    internal_due_at: item.internal_due_at,
  };
}

function draftsEqual(a: ReqDraft, b: ReqDraft): boolean {
  return (
    a.compliance_status === b.compliance_status &&
    a.prep_status === b.prep_status &&
    a.requirement_type === b.requirement_type &&
    a.envelope === b.envelope &&
    a.owner_member_id === b.owner_member_id &&
    a.internal_due_at === b.internal_due_at
  );
}

const TYPE_LABELS: Record<string, string> = {
  excluyente: "Excluyente",
  puntuable: "Puntuable",
  informativo: "Informativo",
};

const TYPE_CLASS: Record<string, string> = {
  excluyente: "text-destructive",
  puntuable: "text-yellow-600",
  informativo: "text-muted-foreground",
};

const TYPE_OPTIONS = OFFER_REQUIREMENT_TYPES.map((value) => ({
  value,
  label: TYPE_LABELS[value] ?? value,
}));

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
  readOnly,
  alignStart,
  ariaLabel,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  tone: ChipTone;
  disabled?: boolean;
  /** Solo lectura visual (p. ej. fila en «No aplica»). */
  locked?: boolean;
  /** Vista: misma estética, sin abrir menú. */
  readOnly?: boolean;
  alignStart?: boolean;
  ariaLabel: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const label = options.find((o) => o.value === value)?.label ?? value;
  const inert = Boolean(disabled || locked || readOnly);

  return (
    <div
      className={cn(
        "relative flex",
        alignStart ? "justify-start" : "justify-center",
      )}
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={Boolean(disabled || locked)}
        aria-disabled={inert}
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
                chipClass[tone],
                readOnly ? "cursor-default" : "cursor-pointer",
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
  readOnly,
  alignStart,
  onChange,
}: {
  value: string | null;
  members: EficenMemberForTeam[];
  disabled?: boolean;
  locked?: boolean;
  readOnly?: boolean;
  alignStart?: boolean;
  onChange: (next: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = members.find((m) => m.id === value) ?? null;
  const inert = Boolean(disabled || locked || readOnly);

  return (
    <div
      className={cn(
        "relative flex",
        alignStart ? "justify-start" : "justify-center",
      )}
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={Boolean(disabled || locked)}
        aria-disabled={inert}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => !inert && setOpen((v) => !v)}
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 rounded-sm text-left text-xs font-medium",
          "outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          locked
            ? "cursor-default text-muted-foreground/45"
            : cn(
                !readOnly && "hover:underline",
                readOnly && "cursor-default",
                disabled && "cursor-wait opacity-60 no-underline",
                selected ? "text-foreground" : "text-muted-foreground",
              ),
        )}
      >
        {selected ? (
          <>
            {selected.avatarUrl ? (
              <MemberAvatar
                name={selected.displayName}
                avatarUrl={selected.avatarUrl}
                muted={locked}
              />
            ) : (
              <PersonIcon
                className={
                  locked
                    ? "text-muted-foreground/45"
                    : "text-muted-foreground"
                }
              />
            )}
            <span className="truncate">
              {shortMemberName(selected.displayName)}
            </span>
          </>
        ) : (
          <span className="truncate">—</span>
        )}
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
                {m.avatarUrl ? (
                  <MemberAvatar
                    name={m.displayName}
                    avatarUrl={m.avatarUrl}
                    className="size-5 text-[0.6rem]"
                  />
                ) : (
                  <PersonIcon />
                )}
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

function ToolbarButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon?: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 px-2 py-1.5",
        "text-sm font-medium text-primary-dark",
        "transition-colors hover:text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50",
      )}
      aria-label={label}
    >
      {icon}
      {label}
    </button>
  );
}

function SelectAllIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
      aria-hidden
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="m8 12 2.5 2.5L16 9" />
    </svg>
  );
}

function ClearSelectionIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
      aria-hidden
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

function RequirementCheck({
  checked,
  disabled,
  ariaLabel,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  ariaLabel: string;
  onChange: () => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      className="size-4 accent-primary"
      onClick={(e) => e.stopPropagation()}
      onChange={onChange}
    />
  );
}

function FiltersIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
      aria-hidden
    >
      <path d="M4 7h16" />
      <path d="M7 12h10" />
      <path d="M10 17h4" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
      aria-hidden
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function OfferRequirementsTable({
  offerCaseId,
  requirements,
  members,
  /** Solo lectura operativa (p. ej. etapa Interés): filtrar sí; sin editar/crear/eliminar. */
  actionsLocked = false,
}: {
  offerCaseId: string;
  requirements: OfferRequirementDetail[];
  members: EficenMemberForTeam[];
  actionsLocked?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<OfferRequirementsFilters>(
    EMPTY_OFFER_REQUIREMENTS_FILTERS,
  );

  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, ReqDraft>>({});
  const [creating, setCreating] = useState(false);
  const [createDirty, setCreateDirty] = useState(false);
  const [creatingBusy, setCreatingBusy] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const leaveResolverRef = useRef<((ok: boolean) => void) | null>(null);

  const filterCount = countOfferRequirementsFilters(filters);

  const ownerOptions = useMemo(
    () =>
      members.map((m) => ({
        value: m.id,
        label: m.displayName,
      })),
    [members],
  );

  const viewRows = useMemo(() => {
    return requirements.map((item) => {
      const draft = drafts[item.id];
      if (!draft) return item;
      return {
        ...item,
        compliance_status: draft.compliance_status,
        prep_status: draft.prep_status,
        requirement_type: draft.requirement_type,
        envelope: draft.envelope,
        owner_member_id: draft.owner_member_id,
        internal_due_at: draft.internal_due_at,
      };
    });
  }, [requirements, drafts]);

  const editDirty = useMemo(() => {
    if (!editing) return false;
    return requirements.some((item) => {
      const draft = drafts[item.id];
      if (!draft) return false;
      return !draftsEqual(draft, snapshotReq(item));
    });
  }, [editing, drafts, requirements]);

  const dirty = editDirty || (creating && createDirty);

  const filteredRows = useMemo(() => {
    const now = Date.now();
    return viewRows.filter((item) => {
      if (
        filters.types.length > 0 &&
        !filters.types.includes(item.requirement_type)
      ) {
        return false;
      }
      if (
        filters.compliance.length > 0 &&
        !filters.compliance.includes(item.compliance_status)
      ) {
        return false;
      }
      if (
        filters.prep.length > 0 &&
        !filters.prep.includes(item.prep_status)
      ) {
        return false;
      }
      if (filters.owners.length > 0) {
        const key = item.owner_member_id ?? OWNER_UNASSIGNED;
        if (!filters.owners.includes(key)) return false;
      }
      if (filters.envelopes.length > 0) {
        const env = item.envelope ?? "ninguno";
        if (!filters.envelopes.includes(env)) return false;
      }
      if (filters.due === "con" && !item.internal_due_at) return false;
      if (filters.due === "sin" && item.internal_due_at) return false;
      if (filters.due === "vencida") {
        if (!item.internal_due_at) return false;
        if (new Date(item.internal_due_at).getTime() >= now) return false;
      }
      return true;
    });
  }, [viewRows, filters]);

  const selectedCount = selectedIds.size;
  const allFilteredSelected =
    filteredRows.length > 0 &&
    filteredRows.every((r) => selectedIds.has(r.id));

  function enterSelecting() {
    setSelecting(true);
    setSelectedIds(new Set());
    setError(null);
  }

  function exitSelecting() {
    setSelecting(false);
    setSelectedIds(new Set());
    setDeletingBusy(false);
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedIds(new Set(filteredRows.map((r) => r.id)));
  }

  async function deleteSelected() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setError(null);
    setDeletingBusy(true);
    const client = createSupabaseBrowserClient();
    const result = await deleteOfferRequirements(client, {
      offerCaseId,
      ids,
    });
    setDeletingBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    exitSelecting();
    startTransition(() => router.refresh());
  }

  function setDraft(id: string, patch: Partial<ReqDraft>) {
    setDrafts((prev) => {
      const base =
        prev[id] ??
        snapshotReq(requirements.find((r) => r.id === id)!);
      let next: ReqDraft = { ...base, ...patch };
      if (
        patch.compliance_status === "cumple" &&
        patch.prep_status === undefined
      ) {
        next = { ...next, prep_status: "listo" };
      }
      const original = snapshotReq(requirements.find((r) => r.id === id)!);
      if (draftsEqual(next, original)) {
        const { [id]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  }

  async function flushDrafts(): Promise<boolean> {
    setError(null);
    const changed = requirements
      .map((item) => {
        const draft = drafts[item.id];
        if (!draft || draftsEqual(draft, snapshotReq(item))) return null;
        return { id: item.id, patch: draft };
      })
      .filter(Boolean) as { id: string; patch: ReqDraft }[];

    if (changed.length === 0) {
      setDrafts({});
      setEditing(false);
      return true;
    }

    setSaving(true);
    const client = createSupabaseBrowserClient();
    for (const row of changed) {
      const result = await updateOfferRequirement(client, {
        id: row.id,
        patch: row.patch,
      });
      if (result.error) {
        setSaving(false);
        setError(result.error.message);
        return false;
      }
    }
    setSaving(false);
    setDrafts({});
    setEditing(false);
    startTransition(() => router.refresh());
    return true;
  }

  function discardDrafts() {
    setDrafts({});
    setEditing(false);
    setCreating(false);
    setCreateDirty(false);
    setError(null);
  }

  function cancelCreating() {
    setCreating(false);
    setCreateDirty(false);
    setError(null);
  }

  async function submitCreate(
    values: OfferRequirementCreateValues,
  ): Promise<boolean> {
    if (!values.requirement_type || !values.category.trim()) {
      return false;
    }
    setError(null);
    setCreatingBusy(true);
    const sortOrder =
      requirements.reduce((max, r) => Math.max(max, r.sort_order), 0) + 1;
    const client = createSupabaseBrowserClient();
    let compliance = values.compliance_status;
    let prep = values.prep_status;
    if (compliance === "cumple") prep = "listo";
    const result = await createOfferRequirement(client, {
      offerCaseId,
      title: values.title,
      requirement_type: values.requirement_type,
      category: values.category,
      compliance_status: compliance,
      prep_status: prep,
      envelope: values.envelope,
      owner_member_id: values.owner_member_id,
      internal_due_at: values.internal_due_at,
      required_value: values.required_value,
      sort_order: sortOrder,
    });
    setCreatingBusy(false);
    if (result.error) {
      setError(result.error.message);
      return false;
    }
    setCreating(false);
    setCreateDirty(false);
    startTransition(() => router.refresh());
    return true;
  }

  const requestLeave = useCallback((): Promise<boolean> => {
    if (!dirty) {
      if (editing) {
        setEditing(false);
        setDrafts({});
      }
      if (creating) {
        setCreating(false);
        setCreateDirty(false);
      }
      return Promise.resolve(true);
    }
    setLeaveOpen(true);
    return new Promise<boolean>((resolve) => {
      leaveResolverRef.current = resolve;
    });
  }, [dirty, editing, creating]);

  useDetailTabsLeaveGuard(editing || creating, () => requestLeave());
  useUnsavedNavigationGuard({
    enabled: editing || creating,
    dirty,
    confirmLeave: requestLeave,
  });

  async function resolveLeave(
    action: "save" | "discard" | "cancel",
  ) {
    setLeaveOpen(false);
    const resolve = leaveResolverRef.current;
    leaveResolverRef.current = null;
    if (!resolve) return;
    if (action === "cancel") {
      resolve(false);
      return;
    }
    if (action === "discard") {
      discardDrafts();
      resolve(true);
      return;
    }
    let ok = true;
    if (editDirty) ok = await flushDrafts();
    if (!ok) {
      resolve(false);
      return;
    }
    if (creating && createDirty) {
      // El alta está en el modal: hay que Crearlo ahí; no forzamos la salida.
      resolve(false);
      return;
    }
    if (creating) cancelCreating();
    resolve(true);
  }

  return (
    <div className="space-y-2">
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {actionsLocked ? (
          <ToolbarButton
            icon={<FiltersIcon />}
            label={filterCount > 0 ? `Filtrar(${filterCount})` : "Filtrar"}
            onClick={() => setFiltersOpen(true)}
          />
        ) : editing ? (
          <>
            <Button
              type="button"
              size="sm"
              disabled={saving || creatingBusy || deletingBusy || !editDirty}
              onClick={() => void flushDrafts()}
            >
              Aplicar cambios
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving || creatingBusy || deletingBusy}
              onClick={() => {
                setDrafts({});
                setEditing(false);
                setError(null);
              }}
            >
              Cancelar
            </Button>
          </>
        ) : selecting ? (
          <>
            <ToolbarButton
              icon={<SelectAllIcon />}
              label="Seleccionar todos"
              disabled={
                deletingBusy ||
                filteredRows.length === 0 ||
                allFilteredSelected
              }
              onClick={selectAllFiltered}
            />
            <ToolbarButton
              icon={<ClearSelectionIcon />}
              label="Desmarcar todos"
              disabled={deletingBusy || selectedCount === 0}
              onClick={() => setSelectedIds(new Set())}
            />
            <ToolbarButton
              icon={<TrashIcon />}
              label="Eliminar"
              disabled={deletingBusy || selectedCount === 0}
              onClick={() => void deleteSelected()}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={deletingBusy}
              onClick={exitSelecting}
            >
              Cancelar
            </Button>
          </>
        ) : (
          <>
            <ToolbarButton
              icon={<FiltersIcon />}
              label={filterCount > 0 ? `Filtrar(${filterCount})` : "Filtrar"}
              onClick={() => setFiltersOpen(true)}
              disabled={saving || creatingBusy || deletingBusy}
            />
            <ToolbarButton
              icon={<EditIcon />}
              label="Editar"
              disabled={saving || creatingBusy || deletingBusy}
              onClick={() => {
                setEditing(true);
                setDrafts({});
                setError(null);
              }}
            />
            <ToolbarButton
              icon={<PlusIcon />}
              label="Crear"
              disabled={saving || creatingBusy || deletingBusy}
              onClick={() => {
                setError(null);
                setCreating(true);
              }}
            />
            <ToolbarButton
              icon={<TrashIcon />}
              label="Eliminar"
              disabled={
                saving ||
                creatingBusy ||
                deletingBusy ||
                requirements.length === 0
              }
              onClick={enterSelecting}
            />
          </>
        )}
      </div>

      {/* Móvil: tarjetas */}
      <div className="space-y-3 md:hidden">
        {filteredRows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Ningún requisito coincide con los filtros.
          </p>
        ) : (
          filteredRows.map((item) => {
            const naLocked = item.compliance_status === "no_aplica";
            const dueDay = item.internal_due_at
              ? calendarDayMadrid(item.internal_due_at)
              : null;
            const readOnly = !editing || selecting;
            const envelopeValue = normalizeEnvelope(item.envelope);
            const isSelected = selectedIds.has(item.id);
            return (
              <article
                key={item.id}
                className={cn(
                  "rounded-lg border border-border bg-surface p-3",
                  naLocked && !selecting && "opacity-80",
                  selecting && isSelected && "border-primary/50 bg-primary/5",
                  selecting && "cursor-pointer",
                )}
                onClick={
                  selecting
                    ? () => {
                        if (!deletingBusy) toggleSelected(item.id);
                      }
                    : undefined
                }
              >
                <div className="flex items-start justify-between gap-2">
                  {selecting ? (
                    <span className="mt-0.5 shrink-0">
                      <RequirementCheck
                        checked={isSelected}
                        disabled={deletingBusy}
                        ariaLabel={`Seleccionar ${item.title}`}
                        onChange={() => toggleSelected(item.id)}
                      />
                    </span>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "line-clamp-2 text-sm font-medium leading-snug",
                        naLocked
                          ? "text-muted-foreground/55"
                          : "text-foreground",
                      )}
                    >
                      {item.title}
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 line-clamp-2 text-xs",
                        naLocked
                          ? "text-muted-foreground/45"
                          : "text-muted-foreground",
                      )}
                    >
                      {[
                        REQUIREMENT_CATEGORY_LABELS[item.category] ??
                          item.category,
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
                  </div>
                  <TypeTextSelect
                    value={item.requirement_type as OfferRequirementType}
                    disabled={saving}
                    locked={naLocked}
                    readOnly={readOnly}
                    alignStart
                    onChange={(v) =>
                      setDraft(item.id, { requirement_type: v })
                    }
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <EditableChipSelect
                    value={item.compliance_status}
                    disabled={saving}
                    readOnly={readOnly}
                    alignStart
                    tone={complianceTone(item.compliance_status)}
                    ariaLabel="Cumplimiento"
                    options={OFFER_COMPLIANCE_STATUSES.map((s) => ({
                      value: s,
                      label: OFFER_COMPLIANCE_LABELS[s],
                    }))}
                    onChange={(v) => {
                      const compliance = v as OfferComplianceStatus;
                      setDraft(item.id, { compliance_status: compliance });
                    }}
                  />
                  <EditableChipSelect
                    value={item.prep_status}
                    disabled={saving}
                    locked={naLocked}
                    readOnly={readOnly}
                    alignStart
                    tone={prepTone(item.prep_status)}
                    ariaLabel="Preparación"
                    options={OFFER_PREP_STATUSES.map((s) => ({
                      value: s,
                      label: OFFER_PREP_LABELS[s],
                    }))}
                    onChange={(v) =>
                      setDraft(item.id, {
                        prep_status: v as OfferPrepStatus,
                      })
                    }
                  />
                </div>

                {(editing ||
                  envelopeValue !== "ninguno" ||
                  item.owner_member_id ||
                  item.internal_due_at) && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                    {(editing || envelopeValue !== "ninguno") && (
                      <EnvelopeTextSelect
                        value={envelopeValue}
                        disabled={saving}
                        locked={naLocked}
                        readOnly={readOnly}
                        alignStart
                        onChange={(v) => setDraft(item.id, { envelope: v })}
                      />
                    )}
                    {(editing || item.owner_member_id) && (
                      <MemberPicker
                        value={item.owner_member_id}
                        members={members}
                        disabled={saving}
                        locked={naLocked}
                        readOnly={readOnly}
                        alignStart
                        onChange={(v) =>
                          setDraft(item.id, { owner_member_id: v })
                        }
                      />
                    )}
                    {(editing || item.internal_due_at) && (
                      <SingleDatePicker
                        value={dueDay}
                        disabled={saving}
                        locked={naLocked}
                        readOnly={readOnly}
                        alignStart
                        toneClassName={
                          item.compliance_status === "cumple"
                            ? "text-muted-foreground"
                            : dueToneClass(item.internal_due_at)
                        }
                        onChange={(day) =>
                          setDraft(item.id, {
                            internal_due_at: day
                              ? `${day}T12:00:00.000Z`
                              : null,
                          })
                        }
                      />
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {/* Desktop / tablet: tabla */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px] table-fixed border-collapse text-sm">
          <colgroup>
            {selecting ? <col className="w-[3rem]" /> : null}
            <col className={selecting ? "w-[49%]" : "w-[52%]"} />
            <col className="w-[6%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[7%]" />
            <col className="w-[11%]" />
            <col className="w-[8%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border text-[0.7rem] uppercase tracking-wide text-muted-foreground">
              {selecting ? (
                <th className="px-2 py-2 text-center font-semibold">
                  <span className="sr-only">Seleccionar</span>
                </th>
              ) : null}
              <th className="px-3 py-2 text-left font-semibold">Requisito</th>
              <th className={thCenter}>Tipo</th>
              <th className={thCenter}>¿Cumplimos?</th>
              <th className={thCenter}>Preparación</th>
              <th className={thCenter}>Sobre</th>
              <th className={thCenter}>Responsable</th>
              <th className={thCenter}>Fecha interna</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={selecting ? 8 : 7}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  Ningún requisito coincide con los filtros.
                </td>
              </tr>
            ) : (
              filteredRows.map((item) => {
                const naLocked = item.compliance_status === "no_aplica";
                const dueDay = item.internal_due_at
                  ? calendarDayMadrid(item.internal_due_at)
                  : null;
                const readOnly = !editing || selecting;
                const envelopeValue = normalizeEnvelope(item.envelope);
                const isSelected = selectedIds.has(item.id);
                return (
                  <tr
                    key={item.id}
                    className={cn(
                      "border-b border-border/80",
                      selecting && isSelected && "bg-primary/5",
                      selecting && "cursor-pointer",
                    )}
                    onClick={
                      selecting
                        ? () => {
                            if (!deletingBusy) toggleSelected(item.id);
                          }
                        : undefined
                    }
                  >
                    {selecting ? (
                      <td className="px-2 py-3 text-center align-middle">
                        <RequirementCheck
                          checked={isSelected}
                          disabled={deletingBusy}
                          ariaLabel={`Seleccionar ${item.title}`}
                          onChange={() => toggleSelected(item.id)}
                        />
                      </td>
                    ) : null}
                    <td
                      className={cn(
                        "px-3 py-3 align-middle font-medium",
                        naLocked
                          ? "text-muted-foreground/55"
                          : "text-foreground",
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
                      <TypeTextSelect
                        value={item.requirement_type as OfferRequirementType}
                        disabled={saving}
                        locked={naLocked}
                        readOnly={readOnly}
                        onChange={(v) =>
                          setDraft(item.id, { requirement_type: v })
                        }
                      />
                    </td>
                    <td className={tdCenter}>
                      <EditableChipSelect
                        value={item.compliance_status}
                        disabled={saving}
                        readOnly={readOnly}
                        tone={complianceTone(item.compliance_status)}
                        ariaLabel="Cumplimiento"
                        options={OFFER_COMPLIANCE_STATUSES.map((s) => ({
                          value: s,
                          label: OFFER_COMPLIANCE_LABELS[s],
                        }))}
                        onChange={(v) => {
                          const compliance = v as OfferComplianceStatus;
                          setDraft(item.id, { compliance_status: compliance });
                        }}
                      />
                    </td>
                    <td className={tdCenter}>
                      <EditableChipSelect
                        value={item.prep_status}
                        disabled={saving}
                        locked={naLocked}
                        readOnly={readOnly}
                        tone={prepTone(item.prep_status)}
                        ariaLabel="Preparación"
                        options={OFFER_PREP_STATUSES.map((s) => ({
                          value: s,
                          label: OFFER_PREP_LABELS[s],
                        }))}
                        onChange={(v) =>
                          setDraft(item.id, {
                            prep_status: v as OfferPrepStatus,
                          })
                        }
                      />
                    </td>
                    <td className={tdCenter}>
                      <EnvelopeTextSelect
                        value={envelopeValue}
                        disabled={saving}
                        locked={naLocked}
                        readOnly={readOnly}
                        onChange={(v) =>
                          setDraft(item.id, { envelope: v })
                        }
                      />
                    </td>
                    <td className={tdCenter}>
                      <MemberPicker
                        value={item.owner_member_id}
                        members={members}
                        disabled={saving}
                        locked={naLocked}
                        readOnly={readOnly}
                        onChange={(v) =>
                          setDraft(item.id, { owner_member_id: v })
                        }
                      />
                    </td>
                    <td className={tdCenter}>
                      <SingleDatePicker
                        value={dueDay}
                        disabled={saving}
                        locked={naLocked}
                        readOnly={readOnly}
                        toneClassName={
                          item.compliance_status === "cumple"
                            ? "text-muted-foreground"
                            : dueToneClass(item.internal_due_at)
                        }
                        onChange={(day) =>
                          setDraft(item.id, {
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
              })
            )}
          </tbody>
        </table>
      </div>

      <OfferRequirementsFiltersModal
        open={filtersOpen}
        ownerOptions={ownerOptions}
        applied={filters}
        onClose={() => setFiltersOpen(false)}
        onApply={(next) => {
          setFilters(next);
          setFiltersOpen(false);
        }}
        onClear={() => {
          setFilters(EMPTY_OFFER_REQUIREMENTS_FILTERS);
          setFiltersOpen(false);
        }}
      />

      <OfferRequirementsCreateModal
        open={creating}
        busy={creatingBusy}
        members={members}
        onClose={cancelCreating}
        onDirtyChange={setCreateDirty}
        onSubmit={async (values) => {
          const ok = await submitCreate(values);
          if (!ok) return;
        }}
      />

      <LeaveWithoutSavingModal
        open={leaveOpen}
        busy={saving}
        onSave={() => void resolveLeave("save")}
        onDiscard={() => void resolveLeave("discard")}
        onCancel={() => void resolveLeave("cancel")}
      />
    </div>
  );
}

function LeaveWithoutSavingModal({
  open,
  busy,
  onSave,
  onDiscard,
  onCancel,
}: {
  open: boolean;
  busy: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  if (typeof document === "undefined" || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-3"
      role="presentation"
      onClick={busy ? undefined : onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="req-leave-title"
        className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="req-leave-title"
          className="text-base font-semibold text-foreground"
        >
          ¿Salir sin guardar?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Hay cambios en los requisitos que aún no se han aplicado.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={onSave}
          >
            Guardar edición
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={onDiscard}
            className="border-destructive text-destructive hover:bg-destructive/10"
          >
            No guardar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={onCancel}
          >
            Cancelar
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
