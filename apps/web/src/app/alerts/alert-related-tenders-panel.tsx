"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatCpvListPreview } from "@/lib/cpv";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  listOwnAlertRelatedQueueItems,
  type AlertRelatedQueueItem,
} from "@/lib/queries";
import { formatTenderStatus } from "@/lib/tender-labels";
import { formatMoney } from "@/app/favorites/favorites-shared";

export type RelatedTendersView = "all" | "sent" | "pending";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-ES", {
      timeZone: "Europe/Madrid",
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function isSendError(status: AlertRelatedQueueItem["status"]): boolean {
  return status === "failed" || status === "cancelled";
}

function FolderTab({
  active,
  label,
  count,
  onSelect,
}: {
  active: boolean;
  label: string;
  count: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={cn(
        "relative z-10 -mb-px inline-flex items-center gap-1.5 rounded-t-lg border px-3.5 py-2 text-sm font-medium transition-colors",
        active
          ? "border-border border-b-[color-mix(in_srgb,var(--surface)_40%,transparent)] bg-surface/40 text-foreground"
          : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
      <span
        className={cn(
          "min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums",
          active
            ? "bg-primary/15 text-primary-dark"
            : "bg-background/80 text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

/**
 * Modal: licitaciones de notification_queue para una alerta.
 * Carpetas Todas / Enviadas / Pendientes (estas dos solo si tienen ítems).
 * Default: Enviadas si hay; si no, Todas.
 */
export function AlertRelatedTendersPanel({
  alertId,
  alertName,
  open,
  onClose,
}: {
  alertId: string;
  alertName: string;
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AlertRelatedQueueItem[]>([]);
  const [view, setView] = useState<RelatedTendersView>("sent");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    void listOwnAlertRelatedQueueItems(client, { alertId }).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.error) {
        setError(result.error.message);
        setItems([]);
        return;
      }
      setItems(result.data);
      const sentCount = result.data.filter((i) => i.status === "sent").length;
      setView(sentCount > 0 ? "sent" : "all");
    });
    return () => {
      cancelled = true;
    };
  }, [open, alertId]);

  const counts = useMemo(() => {
    const all = items.length;
    const sent = items.filter((i) => i.status === "sent").length;
    const pending = items.filter((i) => i.status === "pending").length;
    return { all, sent, pending };
  }, [items]);

  const visible = useMemo(() => {
    if (view === "sent") return items.filter((i) => i.status === "sent");
    if (view === "pending") return items.filter((i) => i.status === "pending");
    return items;
  }, [items, view]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`alert-related-title-${alertId}`}
        className="flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2
              id={`alert-related-title-${alertId}`}
              className="text-lg font-semibold text-foreground"
            >
              Licitaciones relacionadas
            </h2>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {alertName}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-3">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Cargando…
            </p>
          ) : error ? (
            <p className="py-8 text-center text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aún no hay licitaciones en cola para esta alerta.
            </p>
          ) : (
            <>
              <div
                className="flex flex-wrap items-end gap-1 px-1"
                role="tablist"
                aria-label="Filtro de envíos"
              >
                <FolderTab
                  active={view === "all"}
                  label="Todas"
                  count={counts.all}
                  onSelect={() => setView("all")}
                />
                {counts.sent > 0 ? (
                  <FolderTab
                    active={view === "sent"}
                    label="Enviadas"
                    count={counts.sent}
                    onSelect={() => setView("sent")}
                  />
                ) : null}
                {counts.pending > 0 ? (
                  <FolderTab
                    active={view === "pending"}
                    label="Pendientes de enviar"
                    count={counts.pending}
                    onSelect={() => setView("pending")}
                  />
                ) : null}
              </div>

              <div className="relative z-0 overflow-hidden rounded-lg rounded-tl-none border border-border bg-surface/40">
                {visible.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No hay licitaciones en esta vista.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {visible.map((item) => {
                      const title =
                        item.tender?.title?.trim() ||
                        item.payloadTitle ||
                        "Licitación";
                      const showError = isSendError(item.status);
                      return (
                        <li key={item.queueId} className="px-4 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <Link
                              href={`/tenders/${item.tenderId}?from=alerts`}
                              className="min-w-0 flex-1 text-base font-medium text-foreground hover:text-link hover:underline"
                              onClick={onClose}
                            >
                              {title}
                            </Link>
                            {showError ? (
                              <span
                                className="shrink-0 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive"
                                title={item.lastError ?? undefined}
                              >
                                Error al enviar
                              </span>
                            ) : null}
                          </div>
                          {item.tender ? (
                            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                              <div>
                                <dt className="inline">Importe: </dt>
                                <dd className="inline">
                                  {formatMoney(
                                    item.tender.estimated_value,
                                    item.tender.currency,
                                  )}
                                </dd>
                              </div>
                              <div>
                                <dt className="inline">CPV: </dt>
                                <dd className="inline font-mono">
                                  {formatCpvListPreview(item.tender.cpv_codes)}
                                </dd>
                              </div>
                              <div>
                                <dt className="inline">Estado: </dt>
                                <dd className="inline">
                                  {formatTenderStatus(item.tender.status)}
                                </dd>
                              </div>
                            </dl>
                          ) : (
                            <p className="mt-2 text-sm text-muted-foreground">
                              Licitación no disponible en el catálogo
                            </p>
                          )}
                          <p className="mt-2 text-xs text-muted-foreground">
                            {item.status === "sent" && item.sentAt
                              ? `Enviada · ${formatWhen(item.sentAt)}`
                              : item.status === "pending"
                                ? `Pendiente · detectada ${formatWhen(item.createdAt)}`
                                : `En cola · ${formatWhen(item.createdAt)}`}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
