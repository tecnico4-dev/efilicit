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
  formatNotificationTrashExpiry,
  isAlertRelatedActive,
  isAlertRelatedInTrashWindow,
  listOwnAlertRelatedQueueItems,
  listOwnTenderRatings,
  purgeOwnAlertRelatedTrashWindow,
  restoreOwnAlertRelatedFromTrash,
  restoreOwnAlertRelatedManyFromTrash,
  trashOwnAlertRelated,
  trashOwnAlertRelatedMany,
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

type FolderView = "active" | "trash";
type TimeScope = "all" | "last_send" | "range";
type StatusFilter = "all" | "sent" | "pending" | "error";
type RatingFilter = "all" | "rated" | "unrated";

/**
 * Ítems `sent` del último lote de esta alerta: ancla por `sent_at` máximo
 * y agrupa por `digestPeriod` (fallback: mismo `sent_at`).
 */
function itemsFromLastSend(
  items: AlertRelatedQueueItem[],
): AlertRelatedQueueItem[] {
  const sent = items.filter((i) => i.status === "sent" && i.sentAt != null);
  if (sent.length === 0) return [];

  let latestAt = sent[0]!.sentAt!;
  let anchor = sent[0]!;
  for (const i of sent) {
    if (i.sentAt != null && i.sentAt > latestAt) {
      latestAt = i.sentAt;
      anchor = i;
    }
  }

  const period = anchor.digestPeriod;
  if (period) {
    return sent.filter((i) => i.digestPeriod === period);
  }
  return sent.filter((i) => i.sentAt === latestAt);
}

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

/** Día Madrid YYYY-MM-DD a partir de un ISO. */
function dayKeyMadrid(iso: string): string | null {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

function itemDayKey(item: AlertRelatedQueueItem): string | null {
  const iso = item.sentAt ?? item.createdAt;
  return dayKeyMadrid(iso);
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

/** Embudo / filtro (outline). */
function FilterIcon({ className }: { className?: string }) {
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
      <path d="M4 5h16l-6.5 7.5v4.5L10.5 19v-6.5L4 5z" />
    </svg>
  );
}

const destructiveOutlineBtn =
  "border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive";

function RelatedItemRow({
  item,
  score,
  inTrash,
  pending,
  onScoreChange,
  onTrash,
  onRestore,
  onNavigate,
}: {
  item: AlertRelatedQueueItem;
  score: TenderScore | null;
  inTrash: boolean;
  pending: boolean;
  onScoreChange: (tenderId: string, next: TenderScore | null) => Promise<void>;
  onTrash: (queueId: string) => void;
  onRestore: (queueId: string) => void;
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
        {inTrash && item.trashedAt ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {formatNotificationTrashExpiry(item.trashedAt)}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2 pt-0.5">
        {canRate && !inTrash ? (
          <TenderStarRating
            score={score}
            onChange={(next) => onScoreChange(item.tenderId, next)}
          />
        ) : null}
        {inTrash ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => onRestore(item.queueId)}
          >
            Restaurar
          </Button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => onTrash(item.queueId)}
            aria-label="Mover a la papelera"
            title="Mover a la papelera"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-50"
          >
            <TrashIcon className="size-4" />
          </button>
        )}
      </div>
    </li>
  );
}

/**
 * Modal: licitaciones de notification_queue para una alerta.
 * Activas | Papelera + filtros (tiempo / estado / valoración).
 * Papelera solo de este modal (no toca el buzón).
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
  const [folder, setFolder] = useState<FolderView>("active");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [timeScope, setTimeScope] = useState<TimeScope>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [actionPending, setActionPending] = useState(false);
  /** Toast de «Vaciar listado» dentro del modal (el global queda bajo el overlay). */
  const [listUndo, setListUndo] = useState<{
    message: string;
    queueIds: string[];
  } | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!listUndo) return;
    const t = window.setTimeout(() => setListUndo(null), 7000);
    return () => window.clearTimeout(t);
  }, [listUndo]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const queueResult = await listOwnAlertRelatedQueueItems(client, {
      alertId,
      userId,
    });
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
    setLoading(false);
    if (ratingsResult.error) {
      setError(ratingsResult.error.message);
      return;
    }
    setRatings(ratingsResult.data);
  }, [alertId, userId]);

  useEffect(() => {
    if (!open) return;
    setFolder("active");
    setFiltersOpen(false);
    setTimeScope("all");
    setDateFrom("");
    setDateTo("");
    setStatusFilter("all");
    setRatingFilter("all");
    setPage(1);
    setRatings({});
    setListUndo(null);
    void reload();
  }, [open, alertId, userId, reload]);

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

  const activeItems = useMemo(
    () => items.filter((i) => isAlertRelatedActive(i)),
    [items],
  );
  const trashItems = useMemo(
    () => items.filter((i) => isAlertRelatedInTrashWindow(i)),
    [items],
  );

  const lastSendItems = useMemo(
    () => itemsFromLastSend(activeItems),
    [activeItems],
  );

  const filteredActive = useMemo(() => {
    let list = activeItems;

    if (timeScope === "last_send") {
      list = lastSendItems;
    } else if (timeScope === "range") {
      list = list.filter((i) => {
        const day = itemDayKey(i);
        if (!day) return false;
        if (dateFrom && day < dateFrom) return false;
        if (dateTo && day > dateTo) return false;
        return Boolean(dateFrom || dateTo);
      });
      // Sin fechas aún → no filtrar a vacío; mostrar todo hasta que elijan
      if (!dateFrom && !dateTo) list = activeItems;
    }

    if (statusFilter === "sent") {
      list = list.filter((i) => i.status === "sent");
    } else if (statusFilter === "pending") {
      list = list.filter((i) => i.status === "pending");
    } else if (statusFilter === "error") {
      list = list.filter((i) => isSendError(i.status));
    }

    if (ratingFilter === "rated") {
      list = list.filter((i) => ratings[i.tenderId] != null);
    } else if (ratingFilter === "unrated") {
      list = list.filter((i) => ratings[i.tenderId] == null);
    }

    return list;
  }, [
    activeItems,
    lastSendItems,
    timeScope,
    dateFrom,
    dateTo,
    statusFilter,
    ratingFilter,
    ratings,
  ]);

  const visible = folder === "trash" ? trashItems : filteredActive;
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

  function selectFolder(next: FolderView) {
    setFolder(next);
    setPage(1);
  }

  function onPageSizeChange(next: number) {
    setPageSize(next as PageSize);
    setPage(1);
  }

  async function onTrashOne(queueId: string) {
    if (actionPending) return;
    setActionPending(true);
    const client = createSupabaseBrowserClient();
    const { error: err } = await trashOwnAlertRelated(client, {
      userId,
      queueId,
    });
    setActionPending(false);
    if (err) {
      setError(err.message);
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.queueId === queueId
          ? { ...i, trashedAt: new Date().toISOString() }
          : i,
      ),
    );
  }

  async function onRestoreOne(queueId: string) {
    if (actionPending) return;
    setActionPending(true);
    const client = createSupabaseBrowserClient();
    const { error: err } = await restoreOwnAlertRelatedFromTrash(client, {
      userId,
      queueId,
    });
    setActionPending(false);
    if (err) {
      setError(err.message);
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.queueId === queueId ? { ...i, trashedAt: null } : i,
      ),
    );
  }

  async function onEmptyActiveList() {
    if (actionPending || activeItems.length === 0) return;
    setActionPending(true);
    const client = createSupabaseBrowserClient();
    const ids = activeItems.map((i) => i.queueId);
    const { error: err } = await trashOwnAlertRelatedMany(client, {
      userId,
      queueIds: ids,
    });
    setActionPending(false);
    if (err) {
      setError(`No se pudo vaciar el listado: ${err.message}`);
      return;
    }
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((i) =>
        ids.includes(i.queueId) ? { ...i, trashedAt: now } : i,
      ),
    );
    setPage(1);
    setListUndo({
      message: "Se ha vaciado la lista de licitaciones de la alerta.",
      queueIds: ids,
    });
  }

  async function onRevertEmptyList() {
    if (!listUndo || actionPending) return;
    const ids = listUndo.queueIds;
    setActionPending(true);
    const client = createSupabaseBrowserClient();
    const { error: undoErr } = await restoreOwnAlertRelatedManyFromTrash(
      client,
      { userId, queueIds: ids },
    );
    setActionPending(false);
    setListUndo(null);
    if (undoErr) {
      setError(`No se pudo revertir: ${undoErr.message}`);
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        ids.includes(i.queueId) ? { ...i, trashedAt: null } : i,
      ),
    );
    setFolder("active");
    setPage(1);
  }

  async function onRestoreAllTrash() {
    if (actionPending || trashItems.length === 0) return;
    setActionPending(true);
    const client = createSupabaseBrowserClient();
    const ids = trashItems.map((i) => i.queueId);
    const { error: err } = await restoreOwnAlertRelatedManyFromTrash(client, {
      userId,
      queueIds: ids,
    });
    setActionPending(false);
    if (err) {
      setError(err.message);
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        ids.includes(i.queueId) ? { ...i, trashedAt: null } : i,
      ),
    );
    setFolder("active");
    setPage(1);
  }

  async function onEmptyTrash() {
    if (actionPending || trashItems.length === 0) return;
    const ok = window.confirm(
      `¿Vaciar la papelera (${trashItems.length})? Dejarán de verse en este modal (no vuelven a Todas).`,
    );
    if (!ok) return;
    setActionPending(true);
    const client = createSupabaseBrowserClient();
    const ids = trashItems.map((i) => i.queueId);
    const { error: err } = await purgeOwnAlertRelatedTrashWindow(client, {
      userId,
      queueIds: ids,
    });
    setActionPending(false);
    if (err) {
      setError(err.message);
      return;
    }
    const past = new Date(
      Date.now() - 31 * 24 * 60 * 60 * 1000,
    ).toISOString();
    setItems((prev) =>
      prev.map((i) =>
        ids.includes(i.queueId) ? { ...i, trashedAt: past } : i,
      ),
    );
    setPage(1);
  }

  if (!open || !mounted) return null;

  const hasAny = items.length > 0;
  const showEmptyActive = folder === "active" && activeItems.length === 0;
  const showEmptyTrash = folder === "trash" && trashItems.length === 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`alert-related-title-${alertId}`}
        className="relative flex max-h-[min(90vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-xl sm:max-w-4xl"
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
          ) : !hasAny ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aún no hay licitaciones en cola para esta alerta.
            </p>
          ) : (
            <>
              {(() => {
                const filterToggle = (
                  <button
                    type="button"
                    aria-label={
                      filtersOpen ? "Ocultar filtros" : "Mostrar filtros"
                    }
                    aria-expanded={filtersOpen}
                    title="Filtros"
                    onClick={() => setFiltersOpen((o) => !o)}
                    className={cn(
                      "inline-flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors",
                      filtersOpen
                        ? "border-primary bg-primary/10 text-primary-dark"
                        : "border-border bg-surface text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <FilterIcon className="size-4" />
                  </button>
                );
                const actionButtons = (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {filterToggle}
                    {folder === "active" && activeItems.length > 0 ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={actionPending}
                        className={destructiveOutlineBtn}
                        onClick={() => void onEmptyActiveList()}
                      >
                        Vaciar listado
                      </Button>
                    ) : null}
                    {folder === "trash" && trashItems.length > 0 ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={actionPending}
                          onClick={() => void onRestoreAllTrash()}
                        >
                          Restaurar todo
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={actionPending}
                          className={destructiveOutlineBtn}
                          onClick={() => void onEmptyTrash()}
                        >
                          Vaciar papelera
                        </Button>
                      </>
                    ) : null}
                  </div>
                );
                return (
                  <>
                    {filtersOpen ? (
                      <div className="mb-2 flex shrink-0 justify-end">
                        {actionButtons}
                      </div>
                    ) : null}

                    {filtersOpen ? (
                      <div className="mb-3 flex shrink-0 flex-col gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-end">
                        <label className="flex min-w-[9rem] flex-col gap-1 text-xs text-muted-foreground">
                          Tiempo
                          <select
                            className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                            value={timeScope}
                            onChange={(e) => {
                              setTimeScope(e.target.value as TimeScope);
                              setPage(1);
                            }}
                          >
                            <option value="all">Todas las fechas</option>
                            <option value="last_send">Último envío</option>
                            <option value="range">Rango de fechas</option>
                          </select>
                        </label>
                        {timeScope === "range" ? (
                          <>
                            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                              Desde
                              <input
                                type="date"
                                className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                                value={dateFrom}
                                onChange={(e) => {
                                  setDateFrom(e.target.value);
                                  setPage(1);
                                }}
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                              Hasta
                              <input
                                type="date"
                                className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                                value={dateTo}
                                onChange={(e) => {
                                  setDateTo(e.target.value);
                                  setPage(1);
                                }}
                              />
                            </label>
                          </>
                        ) : null}
                        <label className="flex min-w-[9rem] flex-col gap-1 text-xs text-muted-foreground">
                          Estado envío
                          <select
                            className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                            value={statusFilter}
                            onChange={(e) => {
                              setStatusFilter(e.target.value as StatusFilter);
                              setPage(1);
                            }}
                          >
                            <option value="all">Todos</option>
                            <option value="sent">Enviadas</option>
                            <option value="pending">Pendientes</option>
                            <option value="error">Con error</option>
                          </select>
                        </label>
                        <label className="flex min-w-[9rem] flex-col gap-1 text-xs text-muted-foreground">
                          Valoración
                          <select
                            className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                            value={ratingFilter}
                            onChange={(e) => {
                              setRatingFilter(e.target.value as RatingFilter);
                              setPage(1);
                            }}
                          >
                            <option value="all">Todas</option>
                            <option value="rated">Valoradas</option>
                            <option value="unrated">Sin valorar</option>
                          </select>
                        </label>
                      </div>
                    ) : null}

                    <div className="flex shrink-0 flex-wrap items-end justify-between gap-2 px-1">
                      <div
                        className="flex flex-wrap items-end gap-1"
                        role="tablist"
                        aria-label="Todas o papelera"
                      >
                        <FolderTab
                          active={folder === "active"}
                          label="Todas"
                          count={activeItems.length}
                          onSelect={() => selectFolder("active")}
                        />
                        <FolderTab
                          active={folder === "trash"}
                          label="Papelera"
                          count={trashItems.length}
                          onSelect={() => selectFolder("trash")}
                        />
                      </div>
                      {!filtersOpen ? (
                        <div className="mb-px flex items-center">{actionButtons}</div>
                      ) : null}
                    </div>
                  </>
                );
              })()}

              {showEmptyActive ? (
                <div className="relative z-0 overflow-hidden rounded-lg rounded-tl-none border border-border bg-surface/40">
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No hay licitaciones aquí. Las de la papelera siguen
                    disponibles en esa pestaña.
                  </p>
                </div>
              ) : showEmptyTrash ? (
                <div className="relative z-0 overflow-hidden rounded-lg rounded-tl-none border border-border bg-surface/40">
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                    La papelera está vacía.
                  </p>
                </div>
              ) : visible.length === 0 ? (
                <div className="relative z-0 overflow-hidden rounded-lg rounded-tl-none border border-border bg-surface/40">
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Ninguna licitación coincide con los filtros.
                  </p>
                </div>
              ) : (
                <div className="relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg rounded-tl-none border border-border bg-surface/40">
                  <div
                    key={`${folder}-${timeScope}-${statusFilter}-${ratingFilter}-${page}-${pageSize}`}
                    className="min-h-0 flex-1 overflow-y-auto"
                  >
                    <ul className="divide-y divide-border">
                      {pageItems.map((item) => (
                        <RelatedItemRow
                          key={item.queueId}
                          item={item}
                          score={ratings[item.tenderId] ?? null}
                          inTrash={folder === "trash"}
                          pending={actionPending}
                          onScoreChange={onScoreChange}
                          onTrash={(id) => void onTrashOne(id)}
                          onRestore={(id) => void onRestoreOne(id)}
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

        {listUndo ? (
          <div
            className="absolute bottom-4 left-1/2 z-10 w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 rounded-lg border border-border bg-surface px-4 py-3 text-sm shadow-lg"
            role="status"
          >
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => setListUndo(null)}
              className="absolute -right-2.5 -top-2.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground shadow-md hover:bg-muted/90 hover:text-foreground"
            >
              <span aria-hidden className="text-sm leading-none">
                ×
              </span>
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-muted-foreground">{listUndo.message}</span>
              <button
                type="button"
                className="font-medium text-link hover:underline"
                disabled={actionPending}
                onClick={() => void onRevertEmptyList()}
              >
                Revertir
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
