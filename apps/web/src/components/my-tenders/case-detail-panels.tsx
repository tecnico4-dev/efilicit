"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCountdown } from "@/lib/bid-countdown";
import { formatDateMadrid } from "@/lib/datetime";
import {
  BID_STAGE_LABELS,
  BID_STAGES,
  addBidCaseUpdate,
  addChecklistItem,
  createBidDocument,
  deleteBidCase,
  deleteBidCaseUpdate,
  deleteChecklistItem,
  linkDocumentToCase,
  setChecklistItemDone,
  unlinkDocumentFromCase,
  updateBidCase,
  updateChecklistItem,
  type BidCaseDetail,
} from "@/lib/queries";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

type LibraryDoc = {
  id: string;
  title: string;
  url: string | null;
  tags: string[];
};

export function CaseMetaForm({
  caseId,
  initial,
}: {
  caseId: string;
  initial: Pick<
    BidCaseDetail,
    | "stage"
    | "owner_name"
    | "preparation_started_on"
    | "presented_on"
    | "outcome_on"
    | "notes"
  >;
}) {
  const router = useRouter();
  const [stage, setStage] = useState(initial.stage);
  const [ownerName, setOwnerName] = useState(initial.owner_name ?? "");
  const [prep, setPrep] = useState(initial.preparation_started_on ?? "");
  const [presented, setPresented] = useState(initial.presented_on ?? "");
  const [outcome, setOutcome] = useState(initial.outcome_on ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setMsg(null);
    const client = createSupabaseBrowserClient();
    const { error } = await updateBidCase(client, caseId, {
      stage,
      owner_name: ownerName.trim() || null,
      preparation_started_on: prep || null,
      presented_on: presented || null,
      outcome_on: outcome || null,
      notes: notes.trim() || null,
    });
    setPending(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg("Guardado");
    router.refresh();
  }

  async function onRemove() {
    if (!window.confirm("¿Quitar este expediente de Mis licitaciones?")) return;
    setPending(true);
    const client = createSupabaseBrowserClient();
    const { error } = await deleteBidCase(client, caseId);
    setPending(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    router.push("/my-tenders");
    router.refresh();
  }

  return (
    <form onSubmit={onSave} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-muted-foreground">Etapa</span>
          <select
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
          >
            {BID_STAGES.map((s) => (
              <option key={s} value={s}>
                {BID_STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Responsable</span>
          <Input
            className="mt-1"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="Nombre"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Inicio preparación</span>
          <Input
            className="mt-1"
            type="date"
            value={prep}
            onChange={(e) => setPrep(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Fecha presentación</span>
          <Input
            className="mt-1"
            type="date"
            value={presented}
            onChange={(e) => setPresented(e.target.value)}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-muted-foreground">
            Fecha resultado (adjudicación / cierre)
          </span>
          <Input
            className="mt-1 max-w-xs"
            type="date"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-muted-foreground">Notas</span>
        <textarea
          className="mt-1 min-h-[88px] w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Contexto interno, estrategia, riesgos…"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "…" : "Guardar"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={onRemove}
          className="text-destructive hover:text-destructive"
        >
          Quitar del pipeline
        </Button>
        {msg ? (
          <span className="text-xs text-muted-foreground" role="status">
            {msg}
          </span>
        ) : null}
      </div>
    </form>
  );
}

export function ChecklistPanel({
  caseId,
  items,
}: {
  caseId: string;
  items: BidCaseDetail["checklist"];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const due = dueAt
      ? new Date(`${dueAt}T12:00:00`).toISOString()
      : null;
    const { error: addError } = await addChecklistItem(client, {
      bidCaseId: caseId,
      title,
      dueAt: due,
      sortOrder: items.length,
    });
    setPending(false);
    if (addError) {
      setError(addError.message);
      return;
    }
    setTitle("");
    setDueAt("");
    router.refresh();
  }

  async function toggle(id: string, done: boolean) {
    const client = createSupabaseBrowserClient();
    await setChecklistItemDone(client, id, done);
    router.refresh();
  }

  async function setDue(id: string, value: string) {
    const client = createSupabaseBrowserClient();
    await updateChecklistItem(client, id, {
      due_at: value ? new Date(`${value}T12:00:00`).toISOString() : null,
    });
    router.refresh();
  }

  async function remove(id: string) {
    const client = createSupabaseBrowserClient();
    await deleteChecklistItem(client, id);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {items.length === 0 ? (
          <li className="text-sm text-muted-foreground">
            Sin requisitos aún. Añade los del pliego.
          </li>
        ) : (
          items.map((item) => {
            const cd = formatCountdown(item.done_at ? null : item.due_at);
            const dueDate = item.due_at
              ? item.due_at.slice(0, 10)
              : "";
            return (
              <li
                key={item.id}
                className="flex flex-col gap-2 rounded-lg border border-border/80 bg-surface px-3 py-2.5 sm:flex-row sm:items-center"
              >
                <label className="flex min-w-0 flex-1 items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={Boolean(item.done_at)}
                    onChange={(e) => toggle(item.id, e.target.checked)}
                  />
                  <span
                    className={cn(
                      "min-w-0",
                      item.done_at && "text-muted-foreground line-through",
                    )}
                  >
                    {item.title}
                  </span>
                </label>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {!item.done_at ? (
                    <span
                      className={cn(
                        "font-medium",
                        cd.tone === "overdue" && "text-destructive",
                        cd.tone === "soon" && "text-amber-700",
                        cd.tone === "ok" && "text-muted-foreground",
                      )}
                    >
                      {cd.label}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Hecho {formatDateMadrid(item.done_at)}
                    </span>
                  )}
                  <Input
                    type="date"
                    className="h-8 w-auto py-1 text-xs"
                    value={dueDate}
                    onChange={(e) => setDue(item.id, e.target.value)}
                    aria-label={`Plazo de ${item.title}`}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs text-destructive"
                    onClick={() => remove(item.id)}
                  >
                    Quitar
                  </Button>
                </div>
              </li>
            );
          })
        )}
      </ul>

      <form
        onSubmit={onAdd}
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <label className="block min-w-0 flex-1 text-sm">
          <span className="text-muted-foreground">Nuevo requisito</span>
          <Input
            className="mt-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. Declaración responsable"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Plazo</span>
          <Input
            className="mt-1"
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </label>
        <Button type="submit" size="sm" disabled={pending || !title.trim()}>
          Añadir
        </Button>
      </form>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function UpdatesPanel({
  caseId,
  userId,
  updates,
}: {
  caseId: string;
  userId: string;
  updates: BidCaseDetail["updates"];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [happenedOn, setHappenedOn] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const { error: addError } = await addBidCaseUpdate(client, {
      bidCaseId: caseId,
      body,
      happenedOn: happenedOn || undefined,
      createdBy: userId,
    });
    setPending(false);
    if (addError) {
      setError(addError.message);
      return;
    }
    setBody("");
    router.refresh();
  }

  async function remove(id: string) {
    const client = createSupabaseBrowserClient();
    await deleteBidCaseUpdate(client, id);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <ol className="space-y-3">
        {updates.length === 0 ? (
          <li className="text-sm text-muted-foreground">
            Sin novedades. Registra publicaciones, requerimientos o cambios de
            plazo.
          </li>
        ) : (
          updates.map((u) => (
            <li
              key={u.id}
              className="rounded-lg border border-border/80 bg-surface px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {formatDateMadrid(u.happened_on)}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-destructive"
                  onClick={() => remove(u.id)}
                >
                  Borrar
                </Button>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                {u.body}
              </p>
            </li>
          ))
        )}
      </ol>

      <form onSubmit={onAdd} className="space-y-2">
        <label className="block text-sm">
          <span className="text-muted-foreground">Nueva novedad</span>
          <textarea
            className="mt-1 min-h-[72px] w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Ej. Publican Q&A; amplían plazo de oferta…"
          />
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block text-sm">
            <span className="text-muted-foreground">Fecha</span>
            <Input
              className="mt-1"
              type="date"
              value={happenedOn}
              onChange={(e) => setHappenedOn(e.target.value)}
            />
          </label>
          <Button type="submit" size="sm" disabled={pending || !body.trim()}>
            Publicar
          </Button>
        </div>
      </form>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function DocumentsPanel({
  caseId,
  userId,
  linked,
  library,
}: {
  caseId: string;
  userId: string;
  linked: BidCaseDetail["documents"];
  library: LibraryDoc[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState("");
  const [linkId, setLinkId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkedIds = new Set(linked.map((d) => d.id));
  const available = library.filter((d) => !linkedIds.has(d.id));

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const { error: createError } = await createBidDocument(client, {
      title,
      url: url || null,
      tags: tags.split(/[,;]/).map((t) => t.trim()).filter(Boolean),
      createdBy: userId,
      linkToCaseId: caseId,
    });
    setPending(false);
    if (createError) {
      setError(createError.message);
      return;
    }
    setTitle("");
    setUrl("");
    setTags("");
    router.refresh();
  }

  async function onLink(e: FormEvent) {
    e.preventDefault();
    if (!linkId) return;
    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const { error: linkError } = await linkDocumentToCase(client, {
      bidCaseId: caseId,
      documentId: linkId,
    });
    setPending(false);
    if (linkError) {
      setError(linkError.message);
      return;
    }
    setLinkId("");
    router.refresh();
  }

  async function onUnlink(documentId: string) {
    const client = createSupabaseBrowserClient();
    await unlinkDocumentFromCase(client, { bidCaseId: caseId, documentId });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <ul className="space-y-2">
        {linked.length === 0 ? (
          <li className="text-sm text-muted-foreground">
            Sin documentos enlazados. Crea uno o reutiliza de la biblioteca.
          </li>
        ) : (
          linked.map((doc) => (
            <li
              key={doc.id}
              className="rounded-lg border border-border/80 bg-surface px-3 py-2.5 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  {doc.url ? (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-link hover:underline"
                    >
                      {doc.title}
                    </a>
                  ) : (
                    <span className="font-medium">{doc.title}</span>
                  )}
                  {doc.tags.length > 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {doc.tags.join(" · ")}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => onUnlink(doc.id)}
                >
                  Desvincular
                </Button>
              </div>
            </li>
          ))
        )}
      </ul>

      <form onSubmit={onCreate} className="space-y-2 rounded-lg border border-dashed border-border p-3">
        <p className="text-sm font-medium text-foreground">
          Nuevo documento (biblioteca + enlace a este expediente)
        </p>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título"
          required
        />
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL (Drive, SharePoint…)"
          type="url"
        />
        <Input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Tags para reutilizar (cpv, solvencia, modelo…)"
        />
        <Button type="submit" size="sm" disabled={pending || !title.trim()}>
          Crear y enlazar
        </Button>
      </form>

      {available.length > 0 ? (
        <form
          onSubmit={onLink}
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
        >
          <label className="block min-w-0 flex-1 text-sm">
            <span className="text-muted-foreground">
              Reutilizar de la biblioteca
            </span>
            <select
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
              value={linkId}
              onChange={(e) => setLinkId(e.target.value)}
            >
              <option value="">Elegir documento…</option>
              {available.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                  {d.tags.length ? ` (${d.tags.slice(0, 3).join(", ")})` : ""}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" size="sm" disabled={pending || !linkId}>
            Enlazar
          </Button>
        </form>
      ) : null}

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
