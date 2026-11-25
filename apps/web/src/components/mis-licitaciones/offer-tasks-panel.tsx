"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { MisLicitacionesFiltersButton } from "@/components/mis-licitaciones/mis-licitaciones-filters-modal";
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

function TaskNoteCard({
  task,
  index,
  onOpen,
}: {
  task: OfferTaskItem;
  index: number;
  onOpen: () => void;
}) {
  const done = task.done_at != null;
  const tone = NOTE_TONES[index % NOTE_TONES.length]!;
  const tilt = NOTE_TILTS[index % NOTE_TILTS.length]!;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group flex min-h-[9.5rem] flex-col rounded-md border p-3.5 text-left shadow-md transition",
        "hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        tone,
        tilt,
        done && "opacity-65",
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

function TaskEditorModal({
  open,
  mode,
  busy,
  members,
  draft,
  error,
  onChange,
  onClose,
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
  onChange: (patch: Partial<Draft>) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
  onToggleDone?: () => void;
}) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-3 sm:p-6"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <h2
            id={titleId}
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            {mode === "create" ? "Añadir tarea" : "Editar tarea"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex size-8 items-center justify-center rounded-lg border border-destructive bg-surface text-destructive hover:bg-destructive/10 disabled:opacity-50"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 px-4 py-4 sm:px-5">
          <div>
            <label className="text-sm font-medium text-foreground">
              Título
            </label>
            <input
              value={draft.title}
              disabled={busy}
              autoFocus
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 disabled:opacity-50"
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">
              Descripción<span className="text-destructive">*</span>
            </label>
            <textarea
              value={draft.notes}
              disabled={busy}
              rows={3}
              className="mt-1.5 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 disabled:opacity-50"
              onChange={(e) => onChange({ notes: e.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-foreground">
                Asignada a
              </label>
              <select
                value={draft.owner_member_id ?? ""}
                disabled={busy}
                className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/50 disabled:opacity-50"
                onChange={(e) =>
                  onChange({
                    owner_member_id: e.target.value || null,
                  })
                }
              >
                <option value="">Sin asignar</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="text-sm font-medium text-foreground">
                Para cuándo
              </span>
              <div className="mt-1.5">
                <SingleDatePicker
                  value={draft.due_day}
                  disabled={busy}
                  boxed
                  onChange={(day) => onChange({ due_day: day })}
                />
              </div>
            </div>
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 sm:px-5">
          <div className="flex flex-wrap gap-2">
            {mode === "edit" && onToggleDone ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
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
              onClick={onClose}
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
    setEditor("create");
  }

  function openEdit(task: OfferTaskItem) {
    setDraft({
      title: task.title ?? "",
      owner_member_id: task.owner_member_id,
      due_day: task.due_at ? calendarDayMadrid(task.due_at) : null,
      notes: task.notes,
      done: task.done_at != null,
    });
    setFormError(null);
    setEditor(task);
  }

  function closeEditor() {
    if (saving) return;
    setEditor(null);
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
    setEditor(null);
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
    setEditor(null);
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
              onOpen={() => openEdit(task)}
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
        onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
        onClose={closeEditor}
        onSave={() => void save()}
        onDelete={editor && editor !== "create" ? () => void remove() : undefined}
        onToggleDone={
          editor && editor !== "create" ? () => void toggleDone() : undefined
        }
      />
    </div>
  );
}
