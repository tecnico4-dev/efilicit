"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { deleteOwnAlert } from "@/lib/queries";
import type { Database } from "@efilicit/types";

type AlertRow = Database["public"]["Tables"]["alerts"]["Row"];

function TrashIcon({ className }: { className?: string }) {
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
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M4 6h16" />
      <path d="M7 6v13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

/**
 * Elimina una alerta tras confirmación modal (irreversible).
 * CASCADE en BD borra también las filas de `notification_queue` de esa alerta.
 * Sin toast Revertir.
 */
export function RemoveAlertButton({
  alert,
  disabled = false,
}: {
  alert: AlertRow;
  disabled?: boolean;
}) {
  const router = useRouter();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  function dismiss() {
    if (pending) return;
    setOpen(false);
    setError(null);
  }

  async function onConfirm() {
    if (pending || disabled) return;
    setPending(true);
    setError(null);

    const client = createSupabaseBrowserClient();
    const { error: deleteError } = await deleteOwnAlert(client, {
      alertId: alert.id,
    });
    setPending(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending || disabled}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        aria-label="Eliminar alerta"
        title="Eliminar"
        className="inline-flex size-8 items-center justify-center rounded-md text-foreground/75 transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
      >
        <TrashIcon className="size-[1.15rem]" />
      </button>

      {mounted && open
        ? createPortal(
            <div
              className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-3 sm:p-6"
              role="presentation"
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2
                    id={titleId}
                    className="text-base font-semibold text-foreground"
                  >
                    ¿Eliminar esta alerta?
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
                <p className="mt-3 text-sm text-muted-foreground">
                  Se eliminarán las licitaciones relacionadas con esta alerta.
                  <br />
                  Es irreversible.
                </p>
                {error ? (
                  <p className="mt-3 text-xs text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    disabled={pending}
                    onClick={() => void onConfirm()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {pending ? "Eliminando…" : "Aceptar"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={dismiss}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
