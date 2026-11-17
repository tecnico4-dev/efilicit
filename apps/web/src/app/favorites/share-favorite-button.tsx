"use client";

import { useEffect, useState, type ChangeEvent } from "react";
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

const KIND_OPTIONS: FavoriteKind[] = ["propia", "subcontrata"];

/**
 * Avión → modal centrado «Enviar licitación» (Carpeta común | destinatarios).
 * Kind editable; por defecto el del favorito personal.
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
  const [sendKind, setSendKind] = useState<FavoriteKind>(kind);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [members, setMembers] = useState<EficenMemberForShare[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const alreadyInCommon = alreadySharedOwner != null;

  useEffect(() => setMounted(true), []);

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
    // Si ya está en Común: mismo modal, pero destinatarios premarcados.
    setDestination(alreadyInCommon ? "people" : "common");
    setSendKind(kind);
    setNotes("");
    setError(null);
    setSelected([]);
    setOpen(true);
  }

  function dismiss() {
    if (pending) return;
    setOpen(false);
  }

  function onRecipientsChange(e: ChangeEvent<HTMLSelectElement>) {
    const values = Array.from(e.target.selectedOptions, (o) => o.value).filter(
      Boolean,
    );
    setSelected(values);
    if (values.length > 0) setError(null);
  }

  async function onConfirm() {
    if (pending) return;
    const kindLabel = favoriteKindLongLabel(sendKind);

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
        kind: sendKind,
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

    if (selected.length === 0) {
      setError("Selecciona al menos un destinatario.");
      return;
    }
    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const result = await addFavoriteShares(client, {
      fromUserId: userId,
      tenderId,
      toUserIds: selected,
      kind: sendKind,
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
    pending || (destination === "people" && selected.length === 0);

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
            >
              <div className="relative w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-xl">
                <button
                  type="button"
                  disabled={pending}
                  onClick={dismiss}
                  aria-label="Cerrar"
                  title="Cerrar"
                  className="absolute right-3 top-3 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    className="size-3.5"
                    aria-hidden
                  >
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
                <h2
                  id="share-favorite-title"
                  className="pr-8 text-lg font-semibold text-foreground"
                >
                  Enviar licitación
                </h2>
                <p className="mt-2 line-clamp-3 text-sm italic text-muted-foreground">
                  {tenderTitle}
                </p>

                <label className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground">
                  <span>Calificada como</span>
                  <select
                    value={sendKind}
                    disabled={pending}
                    onChange={(e) =>
                      setSendKind(e.target.value as FavoriteKind)
                    }
                    aria-label="Clasificación"
                    className="max-w-[11.5rem] rounded border border-border/70 bg-muted/40 py-0.5 pl-1.5 pr-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {KIND_OPTIONS.map((k) => (
                      <option key={k} value={k}>
                        {favoriteKindLongLabel(k)}
                      </option>
                    ))}
                  </select>
                </label>

                <fieldset className="mt-4">
                  <legend className="text-xs text-muted-foreground">
                    Destino
                  </legend>
                  <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2">
                    <label
                      className={cn(
                        "inline-flex items-center gap-2 text-sm",
                        alreadyInCommon
                          ? "cursor-default text-muted-foreground/55"
                          : "cursor-pointer text-foreground",
                      )}
                    >
                      <input
                        type="radio"
                        name="share-destination"
                        checked={destination === "common"}
                        disabled={pending || alreadyInCommon}
                        onChange={() => {
                          if (alreadyInCommon) return;
                          setDestination("common");
                          setError(null);
                        }}
                      />
                      <span>
                        Carpeta común
                        {alreadyInCommon ? (
                          <span className="text-muted-foreground/55">
                            {" "}
                            (ya está)
                          </span>
                        ) : null}
                      </span>
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-foreground">
                      <input
                        type="radio"
                        name="share-destination"
                        checked={destination === "people"}
                        disabled={pending}
                        onChange={() => {
                          setDestination("people");
                          setSelected([]);
                          setError(null);
                        }}
                      />
                      Elegir destinatario(s)
                    </label>
                  </div>
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
                      <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                        Destinatarios
                        <select
                          multiple
                          value={selected}
                          disabled={pending}
                          onChange={onRecipientsChange}
                          size={Math.min(6, Math.max(3, members.length))}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label="Elegir destinatarios"
                        >
                          {members.map((m) => (
                            <option key={m.id} value={m.userId}>
                              {m.roleTitle
                                ? `${m.displayName} · ${m.roleTitle}`
                                : m.displayName}
                            </option>
                          ))}
                        </select>
                        <span className="text-[11px]">
                          {selected.length === 0
                            ? "Ninguno seleccionado (Ctrl/Cmd + clic para varios)."
                            : `${selected.length} seleccionado${selected.length === 1 ? "" : "s"}.`}
                        </span>
                      </label>
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
