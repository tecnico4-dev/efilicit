"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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

type Destination = "common" | "people";

/**
 * Avión → modal centrado «Enviar licitación» (Común | Personas).
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
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [destination, setDestination] = useState<Destination>("common");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [members, setMembers] = useState<EficenMemberForShare[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [membersLoading, setMembersLoading] = useState(false);

  const kindLabel = favoriteKindLongLabel(kind);
  const alreadyInCommon = alreadySharedOwner != null;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending]);

  useEffect(() => {
    if (!open || destination !== "people") return;
    let cancelled = false;
    setMembersLoading(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    void listEficenMembersForShare(client, userId).then((result) => {
      if (cancelled) return;
      setMembersLoading(false);
      if (result.error) {
        setError(result.error.message);
        setMembers([]);
        return;
      }
      setMembers(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, destination, userId]);

  async function onPlaneClick() {
    if (pending) return;
    setDestination("common");
    setNotes("");
    setError(null);
    setSelected(new Set());
    setOpen(true);
  }

  function dismiss() {
    if (pending) return;
    setOpen(false);
  }

  function toggleMember(userIdTo: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userIdTo)) next.delete(userIdTo);
      else next.add(userIdTo);
      return next;
    });
  }

  async function onConfirm() {
    if (pending) return;

    if (destination === "common") {
      if (alreadySharedOwner) {
        setOpen(false);
        showStatus(sharedFavoriteAlreadyMessage(userId, alreadySharedOwner));
        return;
      }
      setPending(true);
      setError(null);
      const client = createSupabaseBrowserClient();
      const existing = await getSharedFavoriteOwner(client, tenderId);
      if (existing.error) {
        setPending(false);
        setError(existing.error.message);
        return;
      }
      if (existing.data) {
        setPending(false);
        setOpen(false);
        showStatus(sharedFavoriteAlreadyMessage(userId, existing.data));
        router.refresh();
        return;
      }
      const result = await addSharedFavorite(client, {
        userId,
        tenderId,
        kind,
        notes,
      });
      setPending(false);
      if (result.ok) {
        setOpen(false);
        showStatus(`Añadida a Común (${kindLabel}).`);
        router.refresh();
        return;
      }
      if (result.alreadyExists) {
        setOpen(false);
        showStatus(sharedFavoriteAlreadyMessage(userId, result.owner));
        router.refresh();
        return;
      }
      setError(result.error.message);
      return;
    }

    if (selected.size === 0) {
      setError("Selecciona al menos una persona.");
      return;
    }
    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const result = await addFavoriteShares(client, {
      fromUserId: userId,
      tenderId,
      toUserIds: [...selected],
      kind,
      notes,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setOpen(false);
    const parts: string[] = [];
    if (result.inserted > 0) {
      parts.push(
        result.inserted === 1
          ? "Compartida con 1 persona"
          : `Compartida con ${result.inserted} personas`,
      );
    }
    if (result.already.length > 0) {
      parts.push(
        ...result.already.map((id) => {
          const m = members.find((x) => x.userId === id);
          return favoriteShareAlreadyMessage(m?.displayName ?? null);
        }),
      );
    }
    showStatus(parts.join(" · ") || "Sin cambios.");
    router.refresh();
  }

  const confirmDisabled =
    pending || (destination === "people" && selected.size === 0);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => void onPlaneClick()}
        aria-label="Enviar licitación"
        title="Enviar licitación"
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

      {mounted && open
        ? createPortal(
            <div
              className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="share-favorite-title"
              onClick={dismiss}
            >
              <div
                className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h2
                  id="share-favorite-title"
                  className="text-lg font-semibold text-foreground"
                >
                  Enviar licitación
                </h2>
                <p className="mt-2 line-clamp-3 text-sm italic text-muted-foreground">
                  {tenderTitle}
                </p>

                <p className="mt-4 text-sm text-foreground">
                  Calificada como{" "}
                  <span className="font-semibold">{kindLabel}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Así se enviará.
                </p>

                <fieldset className="mt-4 space-y-2">
                  <legend className="text-xs text-muted-foreground">
                    Destino
                  </legend>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="share-destination"
                      checked={destination === "common"}
                      disabled={pending}
                      onChange={() => {
                        setDestination("common");
                        setError(null);
                      }}
                    />
                    <span>
                      Común
                      {alreadyInCommon ? (
                        <span className="text-muted-foreground">
                          {" "}
                          (ya está)
                        </span>
                      ) : null}
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="share-destination"
                      checked={destination === "people"}
                      disabled={pending}
                      onChange={() => {
                        setDestination("people");
                        setError(null);
                      }}
                    />
                    Personas
                  </label>
                </fieldset>

                {destination === "people" ? (
                  <div className="mt-3">
                    {membersLoading ? (
                      <p className="text-xs text-muted-foreground">Cargando…</p>
                    ) : members.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No hay miembros con cuenta enlazada. Crea filas en{" "}
                        <code className="text-[11px]">eficen_members</code>.
                      </p>
                    ) : (
                      <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
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
                  </div>
                ) : null}

                <label className="mt-4 flex flex-col gap-1.5 text-xs text-muted-foreground">
                  Nota (opcional)
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={SHARED_FAVORITE_NOTES_MAX}
                    rows={3}
                    disabled={pending}
                    placeholder="Motivo o comentario…"
                    className="resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <span className="tabular-nums text-[11px]">
                    {notes.length}/{SHARED_FAVORITE_NOTES_MAX}
                  </span>
                </label>

                {error ? (
                  <p className="mt-2 text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}

                <div className="mt-5 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={dismiss}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={confirmDisabled}
                    onClick={() => void onConfirm()}
                  >
                    {pending
                      ? "Enviando…"
                      : destination === "common"
                        ? "Añadir"
                        : "Enviar"}
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** @deprecated Prefer ShareFavoriteButton */
export { ShareFavoriteButton as ShareToCommonButton };
