"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { TenderStarRating } from "@/components/tenders/tender-star-rating";
import { cn } from "@/lib/cn";
import { formatCpvListPreview } from "@/lib/cpv";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  deleteOwnTenderRating,
  listOwnAlertRelatedQueueItems,
  listOwnTenderRatings,
  upsertOwnTenderRating,
  type AlertRelatedQueueItem,
  type TenderScore,
} from "@/lib/queries";
import { formatTenderStatus } from "@/lib/tender-labels";
import { formatMoney } from "@/app/favorites/favorites-shared";
import {
  DEFAULT_PAGE_SIZE,
  ListPager,
  type PageSize,
} from "@/app/favorites/list-pager";

export type RelatedTendersView =
  | "all"
  | "sent"
  | "pending"
  | "rated"
  | "unrated";

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

function RelatedItemRow({
  item,
  score,
  onScoreChange,
  onNavigate,
}: {
  item: AlertRelatedQueueItem;
  score: TenderScore | null;
  onScoreChange: (tenderId: string, next: TenderScore | null) => Promise<void>;
  onNavigate: () => void;
}) {
  const title =
    item.tender?.title?.trim() || item.payloadTitle || "Licitación";
  const showError = isSendError(item.status);
  const canRate = Boolean(item.tender);

  return (
    <li className="flex items-start gap-3 px-4 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <Link
            href={`/tenders/${item.tenderId}?from=alerts`}
            className="min-w-0 flex-1 text-base font-medium text-foreground hover:text-link hover:underline"
            onClick={onNavigate}
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
              <dd className="inline">{formatTenderStatus(item.tender.status)}</dd>
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
      </div>
      {canRate ? (
        <div className="shrink-0 pt-0.5">
          <TenderStarRating
            score={score}
            onChange={(next) => onScoreChange(item.tenderId, next)}
          />
        </div>
      ) : null}
    </li>
  );
}

/**
 * Modal: licitaciones de notification_queue para una alerta.
 * Carpetas Todas / Enviadas / Pendientes / Valoradas / Sin valorar
 * (las condicionales solo si tienen ítems). Default: Todas.
 * Paginación estilo favoritos (10 / 50 / 100).
 * Estrellas 1–5 (misma tabla `tender_ratings` que el buzón).
 */
export function AlertRelatedTendersPanel({
  alertId,
  alertName,
  userId,
  open,
  onClose,
}: {
  alertId: string;
  alertName: string;
  userId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AlertRelatedQueueItem[]>([]);
  const [ratings, setRatings] = useState<Record<string, TenderScore>>({});
  const [view, setView] = useState<RelatedTendersView>("all");
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);

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
    setView("all");
    setPage(1);
    setRatings({});
    const client = createSupabaseBrowserClient();

    void (async () => {
      const queueResult = await listOwnAlertRelatedQueueItems(client, {
        alertId,
      });
      if (cancelled) return;
      if (queueResult.error) {
        setLoading(false);
        setError(queueResult.error.message);
        setItems([]);
        return;
      }
      setItems(queueResult.data);

      const tenderIds = [
        ...new Set(queueResult.data.map((i) => i.tenderId).filter(Boolean)),
      ];
      const ratingsResult = await listOwnTenderRatings(client, {
        userId,
        tenderIds,
      });
      if (cancelled) return;
      setLoading(false);
      if (ratingsResult.error) {
        setError(ratingsResult.error.message);
        return;
      }
      setRatings(ratingsResult.data);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, alertId, userId]);

  const onScoreChange = useCallback(
    async (tenderId: string, next: TenderScore | null) => {
      const client = createSupabaseBrowserClient();
      const prev = ratings[tenderId] ?? null;
      setRatings((r) => {
        const copy = { ...r };
        if (next == null) delete copy[tenderId];
        else copy[tenderId] = next;
        return copy;
      });
      const result =
        next == null
          ? await deleteOwnTenderRating(client, { userId, tenderId })
          : await upsertOwnTenderRating(client, {
              userId,
              tenderId,
              score: next,
            });
      if (result.error) {
        setRatings((r) => {
          const copy = { ...r };
          if (prev == null) delete copy[tenderId];
          else copy[tenderId] = prev;
          return copy;
        });
        setError(result.error.message);
      }
    },
    [ratings, userId],
  );

  const counts = useMemo(() => {
    const all = items.length;
    const sent = items.filter((i) => i.status === "sent").length;
    const pending = items.filter((i) => i.status === "pending").length;
    let rated = 0;
    let unrated = 0;
    for (const i of items) {
      if (ratings[i.tenderId] != null) rated += 1;
      else unrated += 1;
    }
    return { all, sent, pending, rated, unrated };
  }, [items, ratings]);

  const visible = useMemo(() => {
    if (view === "sent") return items.filter((i) => i.status === "sent");
    if (view === "pending") return items.filter((i) => i.status === "pending");
    if (view === "rated")
      return items.filter((i) => ratings[i.tenderId] != null);
    if (view === "unrated")
      return items.filter((i) => ratings[i.tenderId] == null);
    return items;
  }, [items, view, ratings]);

  const total = visible.length;
  const showPager = total > DEFAULT_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pageItems = useMemo(() => {
    const safe = Math.min(Math.max(page, 1), totalPages);
    const start = (safe - 1) * pageSize;
    return visible.slice(start, start + pageSize);
  }, [visible, page, pageSize, totalPages]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // Si la pestaña activa deja de tener ítems (p. ej. valoras la última de «Sin valorar»),
  // volver a Todas para no quedarte en una vista vacía sin tab visible.
  useEffect(() => {
    if (view === "sent" && counts.sent === 0) {
      setView("all");
      setPage(1);
    } else if (view === "pending" && counts.pending === 0) {
      setView("all");
      setPage(1);
    } else if (view === "rated" && counts.rated === 0) {
      setView("all");
      setPage(1);
    } else if (view === "unrated" && counts.unrated === 0) {
      setView("all");
      setPage(1);
    }
  }, [view, counts.sent, counts.pending, counts.rated, counts.unrated]);

  function selectView(next: RelatedTendersView) {
    setView(next);
    setPage(1);
  }

  function onPageSizeChange(next: number) {
    setPageSize(next as PageSize);
    setPage(1);
  }

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
        className="flex max-h-[min(90vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-xl sm:max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
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

        <div className="flex min-h-0 flex-1 flex-col px-5 pb-5 pt-3">
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
                className="flex shrink-0 flex-wrap items-end gap-1 px-1"
                role="tablist"
                aria-label="Filtro de licitaciones"
              >
                <FolderTab
                  active={view === "all"}
                  label="Todas"
                  count={counts.all}
                  onSelect={() => selectView("all")}
                />
                {counts.sent > 0 ? (
                  <FolderTab
                    active={view === "sent"}
                    label="Enviadas"
                    count={counts.sent}
                    onSelect={() => selectView("sent")}
                  />
                ) : null}
                {counts.pending > 0 ? (
                  <FolderTab
                    active={view === "pending"}
                    label="Pendientes de enviar"
                    count={counts.pending}
                    onSelect={() => selectView("pending")}
                  />
                ) : null}
                {counts.rated > 0 ? (
                  <FolderTab
                    active={view === "rated"}
                    label="Valoradas"
                    count={counts.rated}
                    onSelect={() => selectView("rated")}
                  />
                ) : null}
                {counts.unrated > 0 ? (
                  <FolderTab
                    active={view === "unrated"}
                    label="Sin valorar"
                    count={counts.unrated}
                    onSelect={() => selectView("unrated")}
                  />
                ) : null}
              </div>

              {visible.length === 0 ? (
                <div className="relative z-0 overflow-hidden rounded-lg rounded-tl-none border border-border bg-surface/40">
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No hay licitaciones en esta vista.
                  </p>
                </div>
              ) : (
                <div className="relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg rounded-tl-none border border-border bg-surface/40">
                  <div
                    key={`${view}-${page}-${pageSize}`}
                    className="min-h-0 flex-1 overflow-y-auto"
                  >
                    <ul className="divide-y divide-border">
                      {pageItems.map((item) => (
                        <RelatedItemRow
                          key={item.queueId}
                          item={item}
                          score={ratings[item.tenderId] ?? null}
                          onScoreChange={onScoreChange}
                          onNavigate={onClose}
                        />
                      ))}
                    </ul>
                  </div>
                  {showPager ? (
                    <div className="shrink-0 border-t border-border bg-background px-4 py-3">
                      <ListPager
                        page={page}
                        totalPages={totalPages}
                        pageSize={pageSize}
                        showing={pageItems.length}
                        total={total}
                        itemLabel="licitaciones"
                        ariaPageSizeLabel="Licitaciones por página"
                        onPageChange={setPage}
                        onPageSizeChange={onPageSizeChange}
                      />
                    </div>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
