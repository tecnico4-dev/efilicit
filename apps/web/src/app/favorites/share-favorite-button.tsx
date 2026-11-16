"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AnchoredPortal } from "@/components/ui/anchored-portal";
import { useUndoToast } from "@/components/undo-toast";
import { cn } from "@/lib/cn";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  SHARED_FAVORITE_NOTES_MAX,
  addFavoriteShares,
  addSharedFavorite,
  favoriteKindLongLabel,
  favoriteShareAlreadyMessage,
  getSharedFavoriteOwner,
  listEficenMembersForShare,
  sharedFavoriteAlreadyMessage,
  type EficenMemberForShare,
  type FavoriteKind,
  type SharedFavoriteOwnerInfo,
} from "@/lib/queries";

function PaperPlaneIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4Z" />
    </svg>
  );
}

type MenuView = "root" | "people" | "common-notes";

/**
 * Avión: menú Común | Personas (multi-select).
 * Kind heredado del favorito personal.
 */
export function ShareFavoriteButton({
  userId,
  tenderId,
  tenderTitle,
  kind,
  alreadySharedOwner = null,
}: {
  userId: string;
  tenderId: string;
  tenderTitle: string;
  kind: FavoriteKind;
  alreadySharedOwner?: SharedFavoriteOwnerInfo | null;
}) {
  const router = useRouter();
  const { showStatus } = useUndoToast();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState<MenuView>("root");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [members, setMembers] = useState<EficenMemberForShare[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [membersLoading, setMembersLoading] = useState(false);

  const kindLabel = favoriteKindLongLabel(kind);
  const alreadyInCommon = alreadySharedOwner != null;

  useEffect(() => {
    if (!menuOpen) {
      setView("root");
      setNotes("");
      setError(null);
      setSelected(new Set());
    }
  }, [menuOpen]);

  async function openMenu() {
    if (pending) return;
    setMenuOpen(true);
    setView("root");
  }

  async function onPickCommon() {
    if (pending) return;
    if (alreadySharedOwner) {
      setMenuOpen(false);
      showStatus(sharedFavoriteAlreadyMessage(userId, alreadySharedOwner));
      return;
    }
    setPending(true);
    const client = createSupabaseBrowserClient();
    const existing = await getSharedFavoriteOwner(client, tenderId);
    setPending(false);
    if (existing.error) {
      showStatus(existing.error.message);
      setMenuOpen(false);
      return;
    }
    if (existing.data) {
      showStatus(sharedFavoriteAlreadyMessage(userId, existing.data));
      setMenuOpen(false);
      router.refresh();
      return;
    }
    setView("common-notes");
  }

  async function onPickPeople() {
    if (pending) return;
    setView("people");
    setMembersLoading(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const result = await listEficenMembersForShare(client, userId);
    setMembersLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setMembers(result.data);
  }

  async function confirmCommon() {
    if (pending) return;
    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const result = await addSharedFavorite(client, {
      userId,
      tenderId,
      kind,
      notes,
    });
    setPending(false);
    if (result.ok) {
      setMenuOpen(false);
      showStatus(`Añadida a Común (${kindLabel}).`);
      router.refresh();
      return;
    }
    if (result.alreadyExists) {
      setMenuOpen(false);
      showStatus(sharedFavoriteAlreadyMessage(userId, result.owner));
      router.refresh();
      return;
    }
    setError(result.error.message);
  }

  async function confirmPeople() {
    if (pending || selected.size === 0) return;
    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const toUserIds = [...selected];
    const result = await addFavoriteShares(client, {
      fromUserId: userId,
      tenderId,
      toUserIds,
      kind,
      notes,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setMenuOpen(false);
    const parts: string[] = [];
    if (result.inserted > 0) {
      parts.push(
        result.inserted === 1
          ? "Compartida con 1 persona"
          : `Compartida con ${result.inserted} personas`,
      );
    }
    if (result.already.length > 0) {
      const names = result.already.map((id) => {
        const m = members.find((x) => x.userId === id);
        return favoriteShareAlreadyMessage(m?.displayName ?? null);
      });
      parts.push(...names);
    }
    showStatus(parts.join(" · ") || "Sin cambios.");
    router.refresh();
  }

  function toggleMember(userIdTo: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userIdTo)) next.delete(userIdTo);
      else next.add(userIdTo);
      return next;
    });
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        disabled={pending}
        onClick={() => void openMenu()}
        aria-label="Compartir licitación"
        aria-expanded={menuOpen}
        title="Compartir"
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-md transition-colors",
          alreadyInCommon
            ? "text-primary hover:bg-primary/10"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          pending && "opacity-50",
        )}
      >
        <PaperPlaneIcon className="size-4" />
      </button>

      <AnchoredPortal
        open={menuOpen}
        anchorRef={anchorRef}
        onDismiss={() => !pending && setMenuOpen(false)}
        matchAnchorWidth={false}
        minWidth={240}
        maxWidth={320}
        maxHeight={view === "people" ? 360 : null}
        overflowY={view === "people" ? "auto" : "visible"}
        className="rounded-lg border border-border bg-background p-1 shadow-lg"
      >
        {view === "root" ? (
          <div className="flex flex-col p-0.5" role="menu">
            <button
              type="button"
              role="menuitem"
              disabled={pending}
              onClick={() => void onPickCommon()}
              className="rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
            >
              Común
              {alreadyInCommon ? (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Ya está en la carpeta
                </span>
              ) : null}
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={pending}
              onClick={() => void onPickPeople()}
              className="rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
            >
              Personas
            </button>
          </div>
        ) : null}

        {view === "common-notes" ? (
          <div className="flex w-[280px] flex-col gap-2 p-3">
            <p className="text-sm font-medium">Añadir a Común</p>
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {tenderTitle}
            </p>
            <p className="text-xs">
              Calificada como <span className="font-semibold">{kindLabel}</span>
            </p>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Nota (opcional)
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={SHARED_FAVORITE_NOTES_MAX}
                rows={2}
                disabled={pending}
                className="resize-y rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              />
            </label>
            {error ? (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => setView("root")}
              >
                Atrás
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() => void confirmCommon()}
              >
                {pending ? "…" : "Añadir"}
              </Button>
            </div>
          </div>
        ) : null}

        {view === "people" ? (
          <div className="flex w-[280px] flex-col gap-2 p-3">
            <p className="text-sm font-medium">Compartir con personas</p>
            <p className="text-xs text-muted-foreground">
              Calificada como <span className="font-semibold">{kindLabel}</span>
            </p>
            {membersLoading ? (
              <p className="text-xs text-muted-foreground">Cargando…</p>
            ) : members.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No hay miembros con cuenta enlazada. Crea filas en{" "}
                <code className="text-[11px]">eficen_members</code>.
              </p>
            ) : (
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {members.map((m) => {
                  const checked = selected.has(m.userId);
                  return (
                    <li key={m.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMember(m.userId)}
                          disabled={pending}
                          className="size-3.5"
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {m.displayName}
                          {m.roleTitle ? (
                            <span className="text-muted-foreground">
                              {" "}
                              · {m.roleTitle}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Nota (opcional)
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={SHARED_FAVORITE_NOTES_MAX}
                rows={2}
                disabled={pending}
                className="resize-y rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              />
            </label>
            {error ? (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => setView("root")}
              >
                Atrás
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={pending || selected.size === 0}
                onClick={() => void confirmPeople()}
              >
                {pending ? "…" : "Enviar"}
              </Button>
            </div>
          </div>
        ) : null}
      </AnchoredPortal>
    </>
  );
}

/** @deprecated Prefer ShareFavoriteButton */
export { ShareFavoriteButton as ShareToCommonButton };
