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
  type OfferTaskItem,
} from "@/lib/queries";

const OWNER_UNASSIGNED = "__none__";

type TaskFilters = {
  /** "" = todas · open · done */
  status: "" | "open" | "done";
  owners: string[];
  /** "" = todas · con · sin · vencida */
  due: "" | "con" | "sin" | "vencida";
};

const EMPTY_TASK_FILTERS: TaskFilters = {
  status: "",
  owners: [],
  due: "",
};

function countTaskFilters(f: TaskFilters): number {
  return (f.status ? 1 : 0) + (f.owners.length > 0 ? 1 : 0) + (f.due ? 1 : 0);
}

function taskMatchesFilters(task: OfferTaskItem, f: TaskFilters): boolean {
  if (f.status === "open" && task.done_at != null) return false;
  if (f.status === "done" && task.done_at == null) return false;

  if (f.owners.length > 0) {
    const key = task.owner_member_id ?? OWNER_UNASSIGNED;
    if (!f.owners.includes(key)) return false;
  }

  if (f.due === "con" && !task.due_at) return false;
  if (f.due === "sin" && task.due_at) return false;
  if (f.due === "vencida") {
    if (!task.due_at || task.done_at != null) return false;
    if (new Date(task.due_at).getTime() >= Date.now()) return false;
  }

  return true;
}

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
  done: boolean;
};

const EMPTY_DRAFT: Draft = {
  title: "",
  owner_member_id: null,
  due_day: null,
  notes: "",
  done: false,
};

function dueToneClass(dueIso: string | null, done: boolean): string {
  if (done || !dueIso) return "text-muted-foreground";
  const due = new Date(dueIso).getTime();
  if (Number.isNaN(due)) return "text-muted-foreground";
  const days = (due - Date.now()) / (24 * 60 * 60 * 1000);
  if (days < 0) return "text-destructive font-medium";
  if (days <= 3) return "text-amber-700 font-medium dark:text-amber-300";
  return "text-muted-foreground";
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
  const done = task.done_at != null;
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
        "group flex min-h-[9.5rem] flex-col rounded-md border p-3.5 text-left shadow-md transition",
        "hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        tone,
        tilt,
        done && "opacity-65",
        hidden && "invisible pointer-events-none",
      )}
    >
      <span
        className="mb-2 size-2.5 self-center rounded-full bg-black/20 shadow-inner dark:bg-white/25"
        aria-hidden
      />
      <div
        className={cn(
          "flex-1 space-y-1",
          done && "opacity-90 [&_*]:line-through [&_*]:decoration-black/40",
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
        <p className={cn(dueToneClass(task.due_at, done))}>
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

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    setDraft(applied);
  }, [open, applied]);

  if (!mounted || !open) return null;

  function toggleOwner(id: string) {
    setDraft((prev) => {
      const has = prev.owners.includes(id);
      return {
        ...prev,
        owners: has
          ? prev.owners.filter((x) => x !== id)
          : [...prev.owners, id],
      };
    });
  }

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
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <h2
            id={titleId}
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            Filtrar tareas
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-8 items-center justify-center rounded-lg border border-destructive bg-surface text-destructive hover:bg-destructive/10"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 px-4 py-4 sm:px-5">
          <div>
            <p className="text-sm font-medium text-foreground">Estado</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  { value: "", label: "Todas" },
                  { value: "open", label: "Abiertas" },
                  { value: "done", label: "Hechas" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value || "all"}
                  type="button"
                  onClick={() => setDraft((p) => ({ ...p, status: opt.value }))}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                    draft.status === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-surface text-muted-foreground hover:bg-muted",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground">Plazo</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  { value: "", label: "Todas" },
                  { value: "con", label: "Con fecha" },
                  { value: "sin", label: "Sin fecha" },
                  { value: "vencida", label: "Vencida" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value || "due-all"}
                  type="button"
                  onClick={() => setDraft((p) => ({ ...p, due: opt.value }))}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                    draft.due === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-surface text-muted-foreground hover:bg-muted",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground">Asignada a</p>
            <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
              <button
                type="button"
                onClick={() => toggleOwner(OWNER_UNASSIGNED)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                  draft.owners.includes(OWNER_UNASSIGNED)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface text-muted-foreground hover:bg-muted",
                )}
              >
                Sin asignar
              </button>
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleOwner(m.id)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                    draft.owners.includes(m.id)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-surface text-muted-foreground hover:bg-muted",
                  )}
                >
                  {m.displayName}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 sm:px-5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onClear();
              onClose();
            }}
          >
            Limpiar
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onApply(draft);
                onClose();
              }}
            >
              Aplicar
            </Button>
          </div>
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
  onClosed,
  onSave,
  onDelete,
  onToggleDone,
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
  onClosed: () => void;
  onSave: () => void;
  onDelete?: () => void;
  onToggleDone?: () => void;
}) {
  const titleId = useId();
  const noteRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<"enter" | "open" | "leave">("enter");
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
  }, [open]);

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
    if (!open || phase !== "open") return;
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [open, phase, draft.notes]);

  if (!mounted || !open) return null;

  const tone = NOTE_TONES[toneIndex % NOTE_TONES.length]!;
  const { widthRem, rows: noteRows } = noteExpandedMetrics(
    draft.title,
    draft.notes,
  );

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
          draft.done && "opacity-90",
        )}
      >
        <button
          type="button"
          onClick={requestClose}
          disabled={busy}
          className="absolute right-2.5 top-2.5 inline-flex size-7 items-center justify-center rounded-md text-current/60 hover:bg-black/10 hover:text-current disabled:opacity-50"
          aria-label="Cerrar"
        >
          ×
        </button>

        <span
          className="mb-3 size-3 self-center rounded-full bg-black/20 shadow-inner dark:bg-white/25"
          aria-hidden
        />

        <h2 id={titleId} className="sr-only">
          {mode === "create" ? "Añadir tarea" : "Editar tarea"}
        </h2>

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
                onChange={(owner_member_id) => onChange({ owner_member_id })}
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

        {error ? (
          <p className="mt-2 text-xs text-destructive">{error}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {mode === "edit" && onToggleDone ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                className="border-black/15 bg-white/40 dark:border-white/20 dark:bg-black/20"
                onClick={onToggleDone}
              >
                {draft.done ? "Reabrir" : "Marcar hecha"}
              </Button>
            ) : null}
            {mode === "edit" && onDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                className="text-destructive hover:bg-destructive/10"
                onClick={onDelete}
              >
                Eliminar
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={requestClose}
            >
              Cancelar
            </Button>
            <Button type="button" size="sm" disabled={busy} onClick={onSave}>
              {busy ? "Guardando…" : mode === "create" ? "Crear" : "Guardar"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function OfferTasksPanel({
  offerCaseId,
  userId,
  members,
}: {
  offerCaseId: string;
  userId: string;
  members: EficenMemberForTeam[];
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
    () =>
      [...members].sort((a, b) =>
        a.displayName.localeCompare(b.displayName, "es"),
      ),
    [members],
  );

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
      done: task.done_at != null,
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

  async function save() {
    if (!draft.notes.trim()) {
      setFormError("La descripción es obligatoria.");
      return;
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
        return;
      }
    } else if (editor) {
      const result = await updateOfferTask(client, {
        id: editor.id,
        patch: {
          title,
          owner_member_id: draft.owner_member_id,
          due_at: dueAt,
          notes: draft.notes,
          done_at: draft.done ? (editor.done_at ?? new Date().toISOString()) : null,
        },
      });
      setSaving(false);
      if (result.error) {
        setFormError(result.error.message);
        return;
      }
    }
    finishEditor();
    await reload();
  }

  async function toggleDone() {
    if (!editor || editor === "create") return;
    const nextDone = !draft.done;
    setSaving(true);
    setFormError(null);
    const client = createSupabaseBrowserClient();
    const result = await updateOfferTask(client, {
      id: editor.id,
      patch: {
        done_at: nextDone ? new Date().toISOString() : null,
      },
    });
    setSaving(false);
    if (result.error) {
      setFormError(result.error.message);
      return;
    }
    setDraft((d) => ({ ...d, done: nextDone }));
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
        members={assignable}
        draft={draft}
        error={formError}
        toneIndex={editorTone}
        origin={editorOrigin}
        onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
        onClosed={finishEditor}
        onSave={() => void save()}
        onDelete={editor && editor !== "create" ? () => void remove() : undefined}
        onToggleDone={
          editor && editor !== "create" ? () => void toggleDone() : undefined
        }
      />
    </div>
  );
}
