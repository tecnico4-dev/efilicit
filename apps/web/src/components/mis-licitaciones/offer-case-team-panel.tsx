"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  OFFER_MEMBER_ROLE_LABELS,
  addOfferCaseMember,
  clearOfferCaseMemberAssignments,
  countOfferCaseMemberAssignments,
  listEficenMembersForTeam,
  removeOfferCaseMember,
  setOfferCaseOwner,
  type EficenMemberForTeam,
  type OfferCaseTeamMember,
  type OfferOwnerMember,
} from "@/lib/queries";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function MemberAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className="size-8 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground"
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

type PickerMode = "owner" | "worker" | null;

export function OfferCaseTeamPanel({
  offerCaseId,
  owner,
  team,
  /** En Interés: solo responsable; sin bloque de trabajadores. */
  workersEnabled = true,
}: {
  offerCaseId: string;
  owner: OfferOwnerMember | null;
  team: OfferCaseTeamMember[];
  workersEnabled?: boolean;
}) {
  const router = useRouter();
  const [picker, setPicker] = useState<PickerMode>(null);
  const [directory, setDirectory] = useState<EficenMemberForTeam[] | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<{
    membershipId: string;
    memberId: string;
    displayName: string;
    tasks: number;
    requirements: number;
  } | null>(null);

  /** Trabajadores sin el responsable (por si quedó huérfano en datos). */
  const workers = useMemo(
    () => team.filter((row) => row.member_id !== owner?.id),
    [team, owner?.id],
  );

  const teamIds = useMemo(
    () => new Set(workers.map((t) => t.member_id)),
    [workers],
  );

  async function ensureDirectory() {
    if (directory) return directory;
    const client = createSupabaseBrowserClient();
    const result = await listEficenMembersForTeam(client);
    if (result.error) {
      setError(result.error.message);
      return [];
    }
    setDirectory(result.data);
    return result.data;
  }

  async function openPicker(mode: Exclude<PickerMode, null>) {
    setError(null);
    setQuery("");
    if (picker === mode) {
      setPicker(null);
      return;
    }
    setPicker(mode);
    await ensureDirectory();
  }

  function closePicker() {
    if (pending) return;
    setPicker(null);
    setQuery("");
  }

  const filtered = useMemo(() => {
    const list = directory ?? [];
    const q = query.trim().toLocaleLowerCase("es");
    return list.filter((m) => {
      if (picker === "owner" && owner?.id === m.id) return false;
      // El responsable no puede ir también como trabajador
      if (picker === "worker" && (teamIds.has(m.id) || owner?.id === m.id)) {
        return false;
      }
      if (!q) return true;
      return (
        m.displayName.toLocaleLowerCase("es").includes(q) ||
        (m.roleTitle?.toLocaleLowerCase("es").includes(q) ?? false)
      );
    });
  }, [directory, query, picker, owner?.id, teamIds]);

  async function onPickOwner(memberId: string | null) {
    if (pending) return;
    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const result = await setOfferCaseOwner(client, {
      offerCaseId,
      ownerMemberId: memberId,
    });
    if (result.error) {
      setPending(false);
      setError(result.error.message);
      return;
    }
    // Estaba en trabajadores → pasa a responsable (sale del equipo)
    if (memberId) {
      const asWorker = team.find((row) => row.member_id === memberId);
      if (asWorker) {
        const removed = await removeOfferCaseMember(client, asWorker.id);
        if (removed.error) {
          setPending(false);
          setError(removed.error.message);
          return;
        }
      }
    }
    setPending(false);
    setPicker(null);
    setQuery("");
    router.refresh();
  }

  async function onAddWorker(memberId: string) {
    if (pending) return;
    if (owner?.id === memberId) {
      setError("El responsable no se puede añadir también como trabajador");
      return;
    }
    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const result = await addOfferCaseMember(client, {
      offerCaseId,
      memberId,
    });
    setPending(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setPicker(null);
    setQuery("");
    router.refresh();
  }

  async function requestRemoveWorker(row: OfferCaseTeamMember) {
    if (pending) return;
    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const counts = await countOfferCaseMemberAssignments(client, {
      offerCaseId,
      memberId: row.member_id,
    });
    if (counts.error) {
      setPending(false);
      setError(counts.error.message);
      return;
    }
    if (counts.data.tasks > 0 || counts.data.requirements > 0) {
      setPending(false);
      setRemoveConfirm({
        membershipId: row.id,
        memberId: row.member_id,
        displayName: row.member.display_name,
        tasks: counts.data.tasks,
        requirements: counts.data.requirements,
      });
      return;
    }
    const result = await removeOfferCaseMember(client, row.id);
    setPending(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  }

  async function confirmRemoveWorker() {
    if (!removeConfirm || pending) return;
    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const cleared = await clearOfferCaseMemberAssignments(client, {
      offerCaseId,
      memberId: removeConfirm.memberId,
    });
    if (cleared.error) {
      setPending(false);
      setError(cleared.error.message);
      return;
    }
    const result = await removeOfferCaseMember(
      client,
      removeConfirm.membershipId,
    );
    setPending(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setRemoveConfirm(null);
    router.refresh();
  }

  function dismissRemoveConfirm() {
    if (pending) return;
    setRemoveConfirm(null);
  }

  function renderExpandedPicker(mode: "owner" | "worker") {
    return (
      <div className="border-t border-border px-3 py-2.5">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre…"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          autoFocus
        />
        <ul className="mt-2 max-h-56 overflow-y-auto rounded-md border border-border bg-background">
          {directory == null ? (
            <li className="px-3 py-2 text-muted-foreground">Cargando…</li>
          ) : filtered.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">Sin resultados</li>
          ) : (
            filtered.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    void (mode === "owner"
                      ? onPickOwner(m.id)
                      : onAddWorker(m.id))
                  }
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-muted",
                    pending && "opacity-60",
                  )}
                >
                  <MemberAvatar name={m.displayName} avatarUrl={m.avatarUrl} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {m.displayName}
                    </span>
                    {m.roleTitle ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {m.roleTitle}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-sm">
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Responsable
        </h3>
        <div
          className={cn(
            "rounded-lg border border-border",
            picker === "owner" && "border-primary/40",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
            {owner ? (
              <div className="flex min-w-0 items-center gap-2.5">
                <MemberAvatar
                  name={owner.display_name}
                  avatarUrl={owner.avatar_url}
                />
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {owner.display_name}
                  </p>
                  {owner.role_title ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {owner.role_title}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Sin asignar</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                aria-expanded={picker === "owner"}
                onClick={() => void openPicker("owner")}
              >
                {picker === "owner"
                  ? "Cerrar"
                  : owner
                    ? "Cambiar"
                    : "Asignar"}
              </Button>
              {owner && picker !== "owner" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => void onPickOwner(null)}
                >
                  Quitar
                </Button>
              ) : null}
            </div>
          </div>
          {picker === "owner" ? renderExpandedPicker("owner") : null}
        </div>
      </section>

      {workersEnabled ? (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Trabajadores
          </h3>
          {workers.length === 0 ? (
            <p className="text-muted-foreground">Nadie en el equipo aún.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {workers.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <MemberAvatar
                      name={row.member.display_name}
                      avatarUrl={row.member.avatar_url}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {row.member.display_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {OFFER_MEMBER_ROLE_LABELS[row.member_role]}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    aria-label={`Quitar a ${row.member.display_name}`}
                    onClick={() => void requestRemoveWorker(row)}
                  >
                    Quitar
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div
            className={cn(
              "rounded-lg",
              picker === "worker"
                ? "border border-primary/40"
                : "border border-transparent",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 px-0 py-0">
              {picker === "worker" ? (
                <div className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                  <p className="font-medium text-foreground">Añadir persona</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    aria-expanded
                    onClick={closePicker}
                  >
                    Cerrar
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  aria-expanded={false}
                  onClick={() => void openPicker("worker")}
                >
                  Añadir persona
                </Button>
              )}
            </div>
            {picker === "worker" ? renderExpandedPicker("worker") : null}
          </div>
        </section>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <RemoveWorkerConfirmModal
        open={removeConfirm != null}
        busy={pending}
        displayName={removeConfirm?.displayName ?? ""}
        tasks={removeConfirm?.tasks ?? 0}
        requirements={removeConfirm?.requirements ?? 0}
        onConfirm={() => void confirmRemoveWorker()}
        onCancel={dismissRemoveConfirm}
      />
    </div>
  );
}

function RemoveWorkerConfirmModal({
  open,
  busy,
  displayName,
  tasks,
  requirements,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  busy: boolean;
  displayName: string;
  tasks: number;
  requirements: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (typeof document === "undefined" || !open) return null;

  const parts: string[] = [];
  if (tasks > 0) {
    parts.push(tasks === 1 ? "1 tarea" : `${tasks} tareas`);
  }
  if (requirements > 0) {
    parts.push(
      requirements === 1 ? "1 requisito" : `${requirements} requisitos`,
    );
  }
  const assignedLabel = parts.join(" y ");

  return createPortal(
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-3"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-remove-title"
        className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id="team-remove-title"
            className="text-base font-semibold text-foreground"
          >
            ¿Eliminar del equipo?
          </h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-destructive bg-surface text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
            aria-label="Cerrar"
          >
            <span aria-hidden className="text-xl leading-none">
              ×
            </span>
          </button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {displayName.trim() || "Este usuario"} tiene {assignedLabel}{" "}
          asignados. Si lo eliminas del equipo, pasarán a sin asignar. ¿Seguro
          que quieres continuar?
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={onCancel}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
          >
            Eliminar
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
