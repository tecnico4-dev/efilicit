"use client";

import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
  FilterMultiSelect,
  FilterSingleSelect,
} from "@/components/mis-licitaciones/offer-filter-selects";
import { MisLicitacionesFiltersButton } from "@/components/mis-licitaciones/mis-licitaciones-filters-modal";
import { OfferMemberPicker } from "@/components/mis-licitaciones/offer-member-picker";
import { SingleDatePicker } from "@/components/mis-licitaciones/single-date-picker";
import { cn } from "@/lib/cn";
import { calendarDayMadrid, formatDateMadrid } from "@/lib/datetime";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  createOfferTask,
  deleteOfferTask,
  listOfferTasks,
  updateOfferTask,
  type EficenMemberForTeam,
  type OfferCaseTeamMember,
  type OfferOwnerMember,
  type OfferTaskItem,
  type OfferTaskStatus,
} from "@/lib/queries";

function toAssignableMember(m: OfferOwnerMember): EficenMemberForTeam {
  return {
    id: m.id,
    displayName: m.display_name,
    roleTitle: m.role_title,
    avatarUrl: m.avatar_url,
  };
}

/** Responsable + trabajadores del expediente (sin directorio completo). */
function caseTeamAssignable(
  owner: OfferOwnerMember | null,
  team: OfferCaseTeamMember[],
): EficenMemberForTeam[] {
  const byId = new Map<string, EficenMemberForTeam>();
  if (owner) byId.set(owner.id, toAssignableMember(owner));
  for (const row of team) {
    byId.set(row.member.id, toAssignableMember(row.member));
  }
  return [...byId.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "es"),
  );
}

const OWNER_UNASSIGNED = "__none__";

type TaskFilters = {
  /** vacío = todas; por defecto solo pendientes */
  status: OfferTaskStatus[];
  owners: string[];
  /** "" = todas · con · sin · vencida */
  due: "" | "con" | "sin" | "vencida";
};

/** Bandeja principal: solo pendientes. Hechas/descartadas vía filtro. */
const EMPTY_TASK_FILTERS: TaskFilters = {
  status: ["pendiente"],
  owners: [],
  due: "",
};

function isDefaultTaskStatusFilter(status: OfferTaskStatus[]): boolean {
  return status.length === 1 && status[0] === "pendiente";
}

function countTaskFilters(f: TaskFilters): number {
  return (
    (isDefaultTaskStatusFilter(f.status) ? 0 : 1) +
    (f.owners.length > 0 ? 1 : 0) +
    (f.due ? 1 : 0)
  );
}

function taskMatchesFilters(task: OfferTaskItem, f: TaskFilters): boolean {
  if (f.status.length > 0 && !f.status.includes(task.status)) return false;

  if (f.owners.length > 0) {
    const key = task.owner_member_id ?? OWNER_UNASSIGNED;
    if (!f.owners.includes(key)) return false;
  }

  if (f.due === "con" && !task.due_at) return false;
  if (f.due === "sin" && task.due_at) return false;
  if (f.due === "vencida") {
    if (!task.due_at || task.status !== "pendiente") return false;
    if (new Date(task.due_at).getTime() >= Date.now()) return false;
  }

  return true;
}

const TASK_STATUS_OPTIONS: { value: OfferTaskStatus; label: string }[] = [
  { value: "pendiente", label: "Pendientes" },
  { value: "hecha", label: "Hechas" },
  { value: "descartada", label: "Descartadas" },
];

const TASK_DUE_OPTIONS = [
  { value: "", label: "Todas" },
  { value: "con", label: "Con fecha" },
  { value: "sin", label: "Sin fecha" },
  { value: "vencida", label: "Vencida" },
];

const NOTE_TONES = [
  "border-amber-300/70 bg-amber-50 text-amber-950 shadow-amber-900/5 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-50",
  "border-sky-300/70 bg-sky-50 text-sky-950 shadow-sky-900/5 dark:border-sky-500/30 dark:bg-sky-950/40 dark:text-sky-50",
  "border-violet-300/70 bg-violet-50 text-violet-950 shadow-violet-900/5 dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-50",
  "border-lime-300/70 bg-lime-50 text-lime-950 shadow-lime-900/5 dark:border-lime-500/30 dark:bg-lime-950/40 dark:text-lime-50",
  "border-rose-300/70 bg-rose-50 text-rose-950 shadow-rose-900/5 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-50",
] as const;

const NOTE_TILTS = [
  "-rotate-1",
  "rotate-1",
  "-rotate-2",
  "rotate-[1.5deg]",
  "rotate-0",
] as const;

type Draft = {
  title: string;
  owner_member_id: string | null;
  due_day: string | null;
  notes: string;
  status: OfferTaskStatus;
};

const EMPTY_DRAFT: Draft = {
  title: "",
  owner_member_id: null,
  due_day: null,
  notes: "",
  status: "pendiente",
};

function dueToneClass(
  dueIso: string | null,
  status: OfferTaskStatus,
): string {
  if (status !== "pendiente" || !dueIso) return "text-muted-foreground";
  const due = new Date(dueIso).getTime();
  if (Number.isNaN(due)) return "text-muted-foreground";
  const days = (due - Date.now()) / (24 * 60 * 60 * 1000);
  if (days < 0) return "text-destructive font-medium";
  if (days <= 3) return "text-amber-700 font-medium dark:text-amber-300";
  return "text-muted-foreground";
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4 shrink-0", className)}
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4 shrink-0", className)}
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

/** Casilla marcada: distingue hechas en la bandeja. */
function DoneTick({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-5 items-center justify-center rounded-[0.3rem] border-2 border-current bg-current/10",
        className,
      )}
      aria-hidden
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-3.5"
      >
        <path d="M5 13l4 4L19 7" />
      </svg>
    </span>
  );
}

type NoteOrigin = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const NOTE_MOTION_MS = 240;

function TaskNoteCard({
  task,
  index,
  hidden,
  onOpen,
}: {
  task: OfferTaskItem;
  index: number;
  hidden?: boolean;
  onOpen: (origin: NoteOrigin) => void;
}) {
  const closed = task.status !== "pendiente";
  const tone = NOTE_TONES[index % NOTE_TONES.length]!;
  const tilt = NOTE_TILTS[index % NOTE_TILTS.length]!;

  return (
    <button
      type="button"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onOpen({
          top: r.top,
          left: r.left,
          width: r.width,
          height: r.height,
        });
      }}
      className={cn(
        "group relative flex min-h-[9.5rem] flex-col rounded-md border p-3.5 text-left shadow-md transition",
        "hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        tone,
        tilt,
        closed && "opacity-65",
        hidden && "invisible pointer-events-none",
      )}
    >
      {task.status === "hecha" ? (
        <DoneTick className="absolute right-2.5 top-2.5 opacity-90" />
      ) : null}
      {task.status === "descartada" ? (
        <span className="absolute right-2 top-2 text-[0.6rem] font-semibold uppercase tracking-wider opacity-80">
          Descartada
        </span>
      ) : null}
      <span
        className="mb-2 size-2.5 self-center rounded-full bg-black/20 shadow-inner dark:bg-white/25"
        aria-hidden
      />
      <div
        className={cn(
          "flex-1 space-y-1",
          task.status === "hecha" &&
            "opacity-90 [&_*]:line-through [&_*]:decoration-black/40",
          task.status === "descartada" && "opacity-80",
        )}
      >
        {task.title?.trim() ? (
          <p className="text-sm font-semibold leading-snug">{task.title}</p>
        ) : null}
        <p
          className={cn(
            "text-sm leading-snug",
            task.title?.trim()
              ? "line-clamp-3 opacity-90"
              : "font-semibold",
          )}
        >
          {task.notes}
        </p>
      </div>
      <div className="mt-3 space-y-0.5 text-xs opacity-80">
        <p className="truncate">
          {task.owner_member?.display_name?.trim() || "Sin asignar"}
        </p>
        <p className={cn(dueToneClass(task.due_at, task.status))}>
          {task.due_at ? `Para ${formatDateMadrid(task.due_at)}` : "Sin plazo"}
        </p>
      </div>
    </button>
  );
}

function TaskFiltersModal({
  open,
  members,
  applied,
  onClose,
  onApply,
  onClear,
}: {
  open: boolean;
  members: EficenMemberForTeam[];
  applied: TaskFilters;
  onClose: () => void;
  onApply: (next: TaskFilters) => void;
  onClear: () => void;
}) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState<TaskFilters>(applied);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    setDraft(applied);
    setFormKey((k) => k + 1);
  }, [open, applied]);

  if (!mounted || !open) return null;

  const ownerOpts = [
    { value: OWNER_UNASSIGNED, label: "Sin asignar" },
    ...members.map((m) => ({ value: m.id, label: m.displayName })),
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-3 sm:p-6"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[min(92vh,48rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <h2
            id={titleId}
            className="text-lg font-semibold leading-none tracking-tight text-foreground"
          >
            Filtrar tareas
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-destructive bg-surface text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label="Cerrar"
          >
            <span aria-hidden className="text-xl leading-none">
              ×
            </span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <div key={formKey} className="grid gap-4 sm:grid-cols-3">
            <FilterMultiSelect
              id="task-filter-status"
              label="Estado"
              options={TASK_STATUS_OPTIONS}
              selected={draft.status}
              onChange={(status) =>
                setDraft((p) => ({
                  ...p,
                  status: status as OfferTaskStatus[],
                }))
              }
            />
            <FilterMultiSelect
              id="task-filter-owner"
              label="Asignada a"
              options={ownerOpts}
              selected={draft.owners}
              onChange={(owners) => setDraft((p) => ({ ...p, owners }))}
            />
            <FilterSingleSelect
              id="task-filter-due"
              label="Plazo"
              options={TASK_DUE_OPTIONS}
              value={draft.due}
              onChange={(due) =>
                setDraft((p) => ({
                  ...p,
                  due: due as TaskFilters["due"],
                }))
              }
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">
          <Button
            type="button"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            Aplicar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraft(EMPTY_TASK_FILTERS);
              onClear();
            }}
          >
            Limpiar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            Cancelar
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Ancho/alto de la nota ampliada: más texto → más ancha (evita columna estrecha y alta). */
function noteExpandedMetrics(title: string, notes: string): {
  widthRem: number;
  rows: number;
} {
  const text = `${title.trim()}\n${notes.trim()}`.trim();
  const chars = Math.max(text.length, 24);
  const hardLines = Math.max(1, text.split("\n").length);

  // Preferimos un ancho que deje ~8–12 líneas a ~45–55 chars/línea.
  let widthRem = 22 + chars / 36;
  widthRem = Math.min(40, Math.max(20, widthRem));

  const charsPerLine = Math.max(28, Math.floor(widthRem * 2.35));
  const wrapped = Math.ceil(chars / charsPerLine);
  const rows = Math.min(12, Math.max(3, hardLines, wrapped));

  // Si aún quedaría muy alta, ensancha un poco más.
  if (rows >= 9 && widthRem < 36) {
    widthRem = Math.min(40, widthRem + 4);
  }

  return { widthRem, rows };
}

function TaskEditorModal({
  open,
  mode,
  busy,
  members,
  draft,
  error,
  toneIndex,
  origin,
  onChange,
  onReplaceDraft,
  onClosed,
  onSave,
  onDelete,
  onSetStatus,
}: {
  open: boolean;
  mode: "create" | "edit";
  busy: boolean;
  members: EficenMemberForTeam[];
  draft: Draft;
  error: string | null;
  toneIndex: number;
  origin: NoteOrigin | null;
  onChange: (patch: Partial<Draft>) => void;
  onReplaceDraft: (next: Draft) => void;
  onClosed: () => void;
  onSave: () => Promise<boolean>;
  onDelete?: () => void;
  onSetStatus?: (status: OfferTaskStatus) => void;
}) {
  const titleId = useId();
  const noteRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<"enter" | "open" | "leave">("enter");
  const [editing, setEditing] = useState(mode === "create");
  const baselineRef = useRef<Draft>(draft);
  const closingRef = useRef(false);
  const originRef = useRef(origin);
  const busyRef = useRef(busy);
  const onClosedRef = useRef(onClosed);
  originRef.current = origin;
  busyRef.current = busy;
  onClosedRef.current = onClosed;

  const requestClose = useCallback(() => {
    if (busyRef.current || closingRef.current) return;
    closingRef.current = true;
    setPhase("leave");
    const el = noteRef.current;
    const from = originRef.current;
    if (!el) {
      onClosedRef.current();
      return;
    }

    if (!from) {
      el.style.transition = `transform ${NOTE_MOTION_MS}ms ease-in, opacity ${NOTE_MOTION_MS}ms ease-in`;
      el.style.transform = "scale(0.92)";
      el.style.opacity = "0";
      window.setTimeout(() => onClosedRef.current(), NOTE_MOTION_MS);
      return;
    }

    const last = el.getBoundingClientRect();
    const dx = from.left - last.left;
    const dy = from.top - last.top;
    const sx = from.width / Math.max(last.width, 1);
    const sy = from.height / Math.max(last.height, 1);
    el.style.transformOrigin = "top left";
    el.style.transition = `transform ${NOTE_MOTION_MS}ms ease-in, opacity ${NOTE_MOTION_MS}ms ease-in`;
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    window.setTimeout(() => onClosedRef.current(), NOTE_MOTION_MS);
  }, []);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    closingRef.current = false;
    setPhase("enter");
    setEditing(mode === "create");
    baselineRef.current = draft;
    // Solo al abrir: no re-sincronizar draft en cada tecla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  useLayoutEffect(() => {
    if (!open || !noteRef.current) return;
    const el = noteRef.current;
    const from = originRef.current;

    if (!from) {
      el.style.transformOrigin = "center center";
      el.style.transform = "scale(0.92)";
      el.style.opacity = "0.4";
      el.style.transition = "none";
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transition = `transform ${NOTE_MOTION_MS}ms ease-out, opacity ${NOTE_MOTION_MS}ms ease-out`;
          el.style.transform = "none";
          el.style.opacity = "1";
          setPhase("open");
        });
      });
      return;
    }

    const last = el.getBoundingClientRect();
    const dx = from.left - last.left;
    const dy = from.top - last.top;
    const sx = from.width / Math.max(last.width, 1);
    const sy = from.height / Math.max(last.height, 1);
    el.style.transformOrigin = "top left";
    el.style.transition = "none";
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    el.style.opacity = "1";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = `transform ${NOTE_MOTION_MS}ms ease-out, opacity ${NOTE_MOTION_MS}ms ease-out`;
        el.style.transform = "none";
        setPhase("open");
      });
    });
  }, [open]);

  useEffect(() => {
    if (!open || phase !== "open" || !editing) return;
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [open, phase, editing, draft.notes]);

  // En lectura, el baseline sigue el draft (p. ej. tras Marcar hecha / Descartar).
  useEffect(() => {
    if (!editing) baselineRef.current = draft;
  }, [draft, editing]);

  function startEditing() {
    baselineRef.current = draft;
    setEditing(true);
  }

  function cancelEditing() {
    onReplaceDraft(baselineRef.current);
    setEditing(false);
  }

  if (!mounted || !open) return null;

  const tone = NOTE_TONES[toneIndex % NOTE_TONES.length]!;
  const { widthRem, rows: noteRows } = noteExpandedMetrics(
    draft.title,
    draft.notes,
  );
  const assigneeName =
    members.find((m) => m.id === draft.owner_member_id)?.displayName ?? null;
  const dueLabel = draft.due_day
    ? formatDateMadrid(`${draft.due_day}T12:00:00.000Z`)
    : "Sin plazo";

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8",
        "transition-colors duration-200",
        phase === "leave" ? "bg-black/0" : "bg-black/45",
      )}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) requestClose();
      }}
    >
      <div
        ref={noteRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ width: `min(${widthRem}rem, calc(100vw - 2rem))` }}
        className={cn(
          "relative flex max-h-[min(85vh,40rem)] flex-col rounded-md border p-5 shadow-2xl sm:p-6",
          "will-change-transform",
          tone,
          draft.status !== "pendiente" && "opacity-90",
        )}
      >
        {!editing && mode === "edit" && draft.status === "hecha" ? (
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <DoneTick />
            <span className="text-xs font-medium tracking-wide">
              Tarea completada
            </span>
          </div>
        ) : null}
        {!editing && mode === "edit" && draft.status === "descartada" ? (
          <span className="absolute left-3 top-3 text-[0.65rem] font-semibold uppercase tracking-wider opacity-80">
            Descartada
          </span>
        ) : null}

        {!editing && mode === "edit" ? (
          <div className="absolute right-2 top-2 flex items-center gap-0.5">
            <button
              type="button"
              onClick={startEditing}
              disabled={busy}
              className="inline-flex size-8 items-center justify-center rounded-md text-current/65 hover:bg-black/10 hover:text-current disabled:opacity-50"
              aria-label="Editar"
            >
              <PencilIcon />
            </button>
            {onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                disabled={busy}
                className="inline-flex size-8 items-center justify-center rounded-md text-destructive/80 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                aria-label="Eliminar"
              >
                <TrashIcon />
              </button>
            ) : null}
          </div>
        ) : null}

        <span
          className="mb-3 size-3 self-center rounded-full bg-black/20 shadow-inner dark:bg-white/25"
          aria-hidden
        />

        <h2 id={titleId} className="sr-only">
          {mode === "create"
            ? "Añadir tarea"
            : editing
              ? "Editar tarea"
              : "Detalle de tarea"}
        </h2>

        {editing ? (
          <>
            <input
              value={draft.title}
              disabled={busy}
              autoFocus
              aria-label="Título"
              className="w-full bg-transparent text-base font-semibold leading-snug outline-none disabled:opacity-50"
              onChange={(e) => onChange({ title: e.target.value })}
            />
            <textarea
              ref={textareaRef}
              value={draft.notes}
              disabled={busy}
              aria-label="Descripción"
              rows={noteRows}
              className="mt-2 max-h-[min(50vh,22rem)] w-full resize-none overflow-y-auto bg-transparent text-sm leading-relaxed outline-none disabled:opacity-50"
              onChange={(e) => onChange({ notes: e.target.value })}
            />
            <div className="mt-4 grid gap-3 border-t border-black/10 pt-3 dark:border-white/15 sm:grid-cols-2">
              <div>
                <p className="text-[0.7rem] font-medium uppercase tracking-wide opacity-70">
                  Asignada a
                </p>
                <div className="mt-1">
                  <OfferMemberPicker
                    value={draft.owner_member_id}
                    members={members}
                    disabled={busy}
                    boxed
                    ariaLabel="Asignada a"
                    onChange={(owner_member_id) =>
                      onChange({ owner_member_id })
                    }
                  />
                </div>
              </div>
              <div>
                <p className="text-[0.7rem] font-medium uppercase tracking-wide opacity-70">
                  Para cuándo
                </p>
                <div className="mt-1">
                  <SingleDatePicker
                    value={draft.due_day}
                    disabled={busy}
                    boxed
                    onChange={(day) => onChange({ due_day: day })}
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div
              className={cn(
                "space-y-1",
                draft.status === "descartada" && "opacity-80",
              )}
            >
              {draft.title.trim() ? (
                <p className="text-base font-semibold leading-snug">
                  {draft.title}
                </p>
              ) : null}
              <p
                className={cn(
                  "max-h-[min(50vh,22rem)] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed",
                  draft.title.trim() ? "opacity-90" : "font-semibold",
                )}
              >
                {draft.notes}
              </p>
            </div>
            <div className="mt-4 grid gap-3 border-t border-black/10 pt-3 text-sm dark:border-white/15 sm:grid-cols-2">
              <div>
                <p className="text-[0.7rem] font-medium uppercase tracking-wide opacity-70">
                  Asignada a
                </p>
                <p className="mt-1 font-medium">
                  {assigneeName ?? "Sin asignar"}
                </p>
              </div>
              <div>
                <p className="text-[0.7rem] font-medium uppercase tracking-wide opacity-70">
                  Para cuándo
                </p>
                <p
                  className={cn(
                    "mt-1 font-medium",
                    dueToneClass(
                      draft.due_day
                        ? `${draft.due_day}T12:00:00.000Z`
                        : null,
                      draft.status,
                    ),
                  )}
                >
                  {dueLabel}
                </p>
              </div>
            </div>
          </>
        )}

        {error ? (
          <p className="mt-2 text-xs text-destructive">{error}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {editing ? (
            <>
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    const ok = await onSave();
                    if (!ok) return;
                    if (mode === "create") return;
                    baselineRef.current = draft;
                    setEditing(false);
                  })();
                }}
              >
                {busy
                  ? "Guardando…"
                  : mode === "create"
                    ? "Crear"
                    : "Guardar"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={mode === "create" ? requestClose : cancelEditing}
              >
                Cancelar
              </Button>
            </>
          ) : (
            <>
              {onSetStatus && draft.status !== "descartada" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  className="border-black/15 bg-white/40 dark:border-white/20 dark:bg-black/20"
                  onClick={() =>
                    onSetStatus(
                      draft.status === "hecha" ? "pendiente" : "hecha",
                    )
                  }
                >
                  {draft.status === "hecha"
                    ? "Marcar como no hecha"
                    : "Marcar hecha"}
                </Button>
              ) : null}
              {onSetStatus && draft.status !== "hecha" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    onSetStatus(
                      draft.status === "descartada"
                        ? "pendiente"
                        : "descartada",
                    )
                  }
                >
                  {draft.status === "descartada" ? "Reabrir" : "Descartar"}
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function OfferTasksPanel({
  offerCaseId,
  userId,
  owner,
  team,
}: {
  offerCaseId: string;
  userId: string;
  owner: OfferOwnerMember | null;
  team: OfferCaseTeamMember[];
}) {
  const [tasks, setTasks] = useState<OfferTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<"create" | OfferTaskItem | null>(null);
  const [editorTone, setEditorTone] = useState(0);
  const [editorOrigin, setEditorOrigin] = useState<NoteOrigin | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_TASK_FILTERS);

  const assignable = useMemo(
    () => caseTeamAssignable(owner, team),
    [owner, team],
  );

  /** Si la tarea ya tiene un asignado fuera del equipo, lo dejamos visible al editar. */
  const editorMembers = useMemo(() => {
    if (!editor || editor === "create" || !editor.owner_member) {
      return assignable;
    }
    if (assignable.some((m) => m.id === editor.owner_member!.id)) {
      return assignable;
    }
    return [...assignable, toAssignableMember(editor.owner_member)].sort(
      (a, b) => a.displayName.localeCompare(b.displayName, "es"),
    );
  }, [assignable, editor]);

  const filterCount = countTaskFilters(filters);
  const visibleTasks = useMemo(
    () => tasks.filter((t) => taskMatchesFilters(t, filters)),
    [tasks, filters],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const result = await listOfferTasks(client, offerCaseId);
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      setTasks([]);
      return;
    }
    setTasks(result.data);
  }, [offerCaseId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function openCreate() {
    setDraft(EMPTY_DRAFT);
    setFormError(null);
    setEditorTone(0);
    setEditorOrigin(null);
    setEditor("create");
  }

  function openEdit(
    task: OfferTaskItem,
    toneIndex: number,
    origin: NoteOrigin,
  ) {
    setDraft({
      title: task.title ?? "",
      owner_member_id: task.owner_member_id,
      due_day: task.due_at ? calendarDayMadrid(task.due_at) : null,
      notes: task.notes,
      status: task.status,
    });
    setFormError(null);
    setEditorTone(toneIndex);
    setEditorOrigin(origin);
    setEditor(task);
  }

  function finishEditor() {
    setEditor(null);
    setEditorOrigin(null);
    setFormError(null);
  }

  async function save(): Promise<boolean> {
    if (!draft.notes.trim()) {
      setFormError("La descripción es obligatoria.");
      return false;
    }
    setSaving(true);
    setFormError(null);
    const client = createSupabaseBrowserClient();
    const dueAt = draft.due_day ? `${draft.due_day}T12:00:00.000Z` : null;
    const title = draft.title.trim() || null;

    if (editor === "create") {
      const result = await createOfferTask(client, {
        offerCaseId,
        title,
        ownerMemberId: draft.owner_member_id,
        dueAt,
        notes: draft.notes,
        createdBy: userId,
      });
      setSaving(false);
      if (result.error) {
        setFormError(result.error.message);
        return false;
      }
      finishEditor();
      await reload();
      return true;
    }

    if (editor) {
      const result = await updateOfferTask(client, {
        id: editor.id,
        patch: {
          title,
          owner_member_id: draft.owner_member_id,
          due_at: dueAt,
          notes: draft.notes,
          status: draft.status,
        },
      });
      setSaving(false);
      if (result.error) {
        setFormError(result.error.message);
        return false;
      }
      await reload();
      return true;
    }

    setSaving(false);
    return false;
  }

  async function setTaskStatus(status: OfferTaskStatus) {
    if (!editor || editor === "create") return;
    setSaving(true);
    setFormError(null);
    const client = createSupabaseBrowserClient();
    const result = await updateOfferTask(client, {
      id: editor.id,
      patch: { status },
    });
    setSaving(false);
    if (result.error) {
      setFormError(result.error.message);
      return;
    }
    setDraft((d) => {
      const next = { ...d, status };
      return next;
    });
    await reload();
  }

  async function remove() {
    if (!editor || editor === "create") return;
    if (!window.confirm("¿Eliminar esta tarea?")) return;
    setSaving(true);
    setFormError(null);
    const client = createSupabaseBrowserClient();
    const result = await deleteOfferTask(client, editor.id);
    setSaving(false);
    if (result.error) {
      setFormError(result.error.message);
      return;
    }
    finishEditor();
    await reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Tareas sueltas del expediente (no son requisitos).
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <MisLicitacionesFiltersButton
            activeCount={filterCount}
            onClick={() => setFiltersOpen(true)}
          />
          <Button type="button" size="sm" onClick={openCreate}>
            Añadir tarea
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando tareas…</p>
      ) : tasks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Aún no hay tareas. Pulsa «Añadir tarea» para crear la primera.
        </p>
      ) : visibleTasks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Ninguna tarea coincide con el filtro.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleTasks.map((task, index) => (
            <TaskNoteCard
              key={task.id}
              task={task}
              index={index}
              hidden={
                editor != null &&
                editor !== "create" &&
                editor.id === task.id
              }
              onOpen={(origin) => openEdit(task, index, origin)}
            />
          ))}
        </div>
      )}

      <TaskFiltersModal
        open={filtersOpen}
        members={assignable}
        applied={filters}
        onClose={() => setFiltersOpen(false)}
        onApply={setFilters}
        onClear={() => setFilters(EMPTY_TASK_FILTERS)}
      />

      <TaskEditorModal
        open={editor != null}
        mode={editor === "create" ? "create" : "edit"}
        busy={saving}
        members={editorMembers}
        draft={draft}
        error={formError}
        toneIndex={editorTone}
        origin={editorOrigin}
        onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
        onReplaceDraft={setDraft}
        onClosed={finishEditor}
        onSave={save}
        onDelete={editor && editor !== "create" ? () => void remove() : undefined}
        onSetStatus={
          editor && editor !== "create"
            ? (status) => void setTaskStatus(status)
            : undefined
        }
      />
    </div>
  );
}
