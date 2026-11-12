"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useUndoToast } from "@/components/undo-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { removeSharedFavorite } from "@/lib/queries";

/** Quitar de Común (cualquier usuario app). */
export function RemoveSharedFavoriteButton({
  tenderId,
  userId,
  addedBy,
  addedByDisplayName,
}: {
  tenderId: string;
  userId: string;
  addedBy: string;
  addedByDisplayName: string | null;
}) {
  const router = useRouter();
  const { showStatus } = useUndoToast();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pending, setPending] = useState(false);

  const removingOthers = addedBy !== userId;
  const ownerName = addedByDisplayName?.trim() || "su autor";

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending]);

  function dismiss() {
    if (pending) return;
    setOpen(false);
  }

  async function onConfirm() {
    if (pending) return;
    setPending(true);
    const client = createSupabaseBrowserClient();
    const { error } = await removeSharedFavorite(client, tenderId);
    setPending(false);
    if (error) {
      showStatus(`No se pudo quitar: ${error.message}`);
      return;
    }
    setOpen(false);
    showStatus("Quitada de Común.");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-muted-foreground underline-offset-2 hover:text-destructive hover:underline disabled:opacity-50"
      >
        Quitar
      </button>

      {mounted && open
        ? createPortal(
            <div
              className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-3 sm:p-6"
              role="presentation"
              onClick={dismiss}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2
                    id={titleId}
                    className="text-base font-semibold text-foreground"
                  >
                    ¿Estás seguro de que quieres eliminar esta licitación de la
                    carpeta Común?
                  </h2>
                  <button
                    type="button"
                    onClick={dismiss}
                    disabled={pending}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-destructive bg-surface text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-60"
                    aria-label="Cerrar"
                  >
                    <span aria-hidden className="text-xl leading-none">
                      ×
                    </span>
                  </button>
                </div>
                {removingOthers ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Se notificará a {ownerName} de que has quitado su
                    licitación de los favoritos compartidos.
                  </p>
                ) : null}
                <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    disabled={pending}
                    onClick={() => void onConfirm()}
                  >
                    {pending ? "Quitando…" : "Sí"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={dismiss}
                    className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    No
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
