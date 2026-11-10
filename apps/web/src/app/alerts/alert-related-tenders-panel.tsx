"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { PublicationDateRange } from "@/components/criteria/publication-date-range";
import { TenderStarRating } from "@/components/tenders/tender-star-rating";
import { cn } from "@/lib/cn";
import { formatCpvListPreview } from "@/lib/cpv";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  dedupeAlertRelatedByTender,
  deleteOwnTenderRating,
  formatNotificationTrashExpiry,
  isAlertRelatedActive,
  isAlertRelatedInTrashWindow,
  listOwnAlertRelatedQueueItems,
  listOwnTenderRatings,
  purgeOwnAlertRelatedTrashWindow,
  queueIdsForTender,
  restoreOwnAlertRelatedFromTrash,
  restoreOwnAlertRelatedManyFromTrash,
  trashOwnAlertRelated,
  trashOwnAlertRelatedMany,
  upsertOwnTenderRating,
  type AlertRelatedQueueItem,
  type TenderInterestKind,
  type TenderRating,
  type TenderScore,
} from "@/lib/queries";
import { formatTenderStatus } from "@/lib/tender-labels";
import { formatMoney } from "@/app/favorites/favorites-shared";
import {
  DEFAULT_PAGE_SIZE,
  ListPager,
  type PageSize,
} from "@/app/favorites/list-pager";
import { ScoreFilterSelect } from "./score-filter-select";

type FolderView = "active" | "trash";
type StatusFilter = "all" | "sent" | "pending";
type RatingFilter = "all" | "rated" | "unrated";
/** Solo visible con Valoradas. */
type InterestFilter = "all" | TenderInterestKind;

/**
 * Ítems `sent` del último lote de esta alerta: ancla por `sent_at` máximo
 * y agrupa por `digestPeriod` legacy si existe (si no, mismo `sent_at`).
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

/** Anchos reservados (px) para Tiempo + Estado + Valoración + Interés + Puntuación. */
const FILTER_TIEMPO_PX = 13.75 * 16;
const FILTER_FIELD_PX = 9 * 16;
/** Select puntuación multi (p. ej. «1★, 3★-5★»). */
const FILTER_SCORE_PX = 9 * 16;
const FILTER_GAP_PX = 8;
const FILTER_ROW_PAD_PX = 24; // px-3 × 2
const FILTER_SELECT_CHROME_PX = 40; // padding + borde + flecha nativa
const FILTER_ALERT_MIN_PX = 9 * 16;

function measureAlertSelectNeededPx(names: string[]): number {
  if (typeof document === "undefined") return FILTER_ALERT_MIN_PX;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return FILTER_ALERT_MIN_PX;
  const sample = document.body;
  const style = sample ? getComputedStyle(sample) : null;
  const family =
    style?.fontFamily ||
    'ui-sans-serif, system-ui, sans-serif, "Segoe UI", Roboto';
  ctx.font = `400 14px ${family}`;
  let longest = ctx.measureText("Todas").width;
  for (const name of names) {
    longest = Math.max(longest, ctx.measureText(name).width);
  }
  return Math.ceil(longest + FILTER_SELECT_CHROME_PX);
}

function maxAlertSelectWidthPx(containerInnerWidth: number): number {
  // Tiempo + Alerta + Estado + Valoración + Interés + Puntuación.
  const reservedOthers =
    FILTER_TIEMPO_PX +
    FILTER_FIELD_PX * 3 +
    FILTER_SCORE_PX +
    FILTER_GAP_PX * 5 +
    FILTER_ROW_PAD_PX;
  return Math.max(
    FILTER_ALERT_MIN_PX,
    Math.floor(containerInnerWidth - reservedOthers),
  );
}

function RelatedItemRow({
  item,
  rating,
  inTrash,
  pending,
  onRatingChange,
  onTrash,
  onRestore,
  onNavigate,
}: {
  item: AlertRelatedQueueItem;
  rating: TenderRating | null;
  inTrash: boolean;
  pending: boolean;
  onRatingChange: (
    tenderId: string,
    next: TenderRating | null,
  ) => Promise<void>;
  onTrash: (queueId: string) => void;
  onRestore: (queueId: string) => void;
  onNavigate?: () => void;
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
            rating={rating}
            onChange={(next) => onRatingChange(item.tenderId, next)}
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
 * Licitaciones de `notification_queue` (una alerta o todas).
 * Activas | Papelera + filtros. Papelera = `alert_related_trash` (no el buzón).
 * `modal` = Relacionadas por alerta (1 fila por cola).
 * `embedded` = Coincidencias (1 fila por licitación; basura/restaurar afecta a todas las colas de esa licitación).
 */
export function AlertRelatedTendersPanel({
  alertId,
  alertName,
  userId,
  open,
  onClose,
  variant = "modal",
}: {
  /** Si falta, carga la cola de todas las alertas del usuario. */
  alertId?: string;
  alertName?: string;
  userId: string;
  open: boolean;
  onClose: () => void;
  variant?: "modal" | "embedded";
}) {
  const isEmbedded = variant === "embedded";
  const scopeId = alertId ?? "all";
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AlertRelatedQueueItem[]>([]);
  const [ratings, setRatings] = useState<Record<string, TenderRating>>({});
  const [folder, setFolder] = useState<FolderView>("active");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [lastSendOnly, setLastSendOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
  const [interestFilter, setInterestFilter] = useState<InterestFilter>("all");
  /** Vacío = Cualquiera (sin filtro de nota). Solo con Valoradas. */
  const [scoreFilter, setScoreFilter] = useState<TenderScore[]>([]);
  /** Solo Coincidencias (embedded): filtrar por alerta de origen. */
  const [alertFilter, setAlertFilter] = useState<string>("all");
  const [alertOptions, setAlertOptions] = useState<
    { id: string; name: string }[]
  >([]);
  /** Ancho fijo del select Alerta mientras la pestaña Coincidencias está abierta. */
  const [alertSelectWidthPx, setAlertSelectWidthPx] = useState<number | null>(
    null,
  );
  const contentRef = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [actionPending, setActionPending] = useState(false);
  /** Toast de «Vaciar listado» dentro del modal (el global queda bajo el overlay). */
  const [listUndo, setListUndo] = useState<{
    message: string;
    queueIds: string[];
  } | null>(null);

  useEffect(() => setMounted(true), []);

  // Ancho del desplegable Alerta: una vez por apertura de Coincidencias.
  useEffect(() => {
    if (
      !isEmbedded ||
      loading ||
      alertOptions.length === 0 ||
      alertSelectWidthPx != null
    ) {
      return;
    }
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      const el = contentRef.current;
      if (cancelled || !el || el.clientWidth <= 0) return;
      const needed = measureAlertSelectNeededPx(
        alertOptions.map((a) => a.name),
      );
      const capped = Math.min(needed, maxAlertSelectWidthPx(el.clientWidth));
      setAlertSelectWidthPx(Math.max(FILTER_ALERT_MIN_PX, capped));
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [isEmbedded, loading, alertOptions, alertSelectWidthPx]);

  useEffect(() => {
    if (!listUndo) return;
    const t = window.setTimeout(() => setListUndo(null), 7000);
    return () => window.clearTimeout(t);
  }, [listUndo]);

  useEffect(() => {
    if (!open || isEmbedded) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, isEmbedded]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const queueResult = await listOwnAlertRelatedQueueItems(client, {
      userId,
      ...(alertId ? { alertId } : {}),
    });
    if (queueResult.error) {
      setLoading(false);
      setError(queueResult.error.message);
      setItems([]);
      return;
    }
    setItems(queueResult.data);

    if (!alertId) {
      const ids = [
        ...new Set(
          queueResult.data
            .map((i) => i.alertId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      if (ids.length === 0) {
        setAlertOptions([]);
      } else {
        const { data: alertRows, error: alertErr } = await client
          .from("alerts")
          .select("id, name")
          .eq("user_id", userId)
          .in("id", ids);
        if (alertErr) {
          setLoading(false);
          setError(alertErr.message);
          return;
        }
        setAlertOptions(
          [...(alertRows ?? [])]
            .map((a) => ({ id: a.id, name: a.name }))
            .sort((a, b) => a.name.localeCompare(b.name, "es")),
        );
      }
    } else {
      setAlertOptions([]);
    }

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

  const isOpen = isEmbedded || open;

  useEffect(() => {
    if (!isOpen) return;
    setFolder("active");
    setFiltersOpen(false);
    setLastSendOnly(false);
    setDateFrom("");
    setDateTo("");
    setStatusFilter("all");
    setRatingFilter("all");
    setInterestFilter("all");
    setScoreFilter([]);
    setAlertFilter("all");
    setPage(1);
    setRatings({});
    setListUndo(null);
    void reload();
  }, [isOpen, alertId, userId, reload]);

  const onRatingChange = useCallback(
    async (tenderId: string, next: TenderRating | null) => {
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
              score: next.score,
              interestKind: next.interestKind,
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

  const scopedItems = useMemo(() => {
    if (!isEmbedded || alertFilter === "all") return items;
    return items.filter((i) => i.alertId === alertFilter);
  }, [items, isEmbedded, alertFilter]);

  /** Filas de cola activas en el alcance (alerta / Todas). */
  const activeQueueItems = useMemo(
    () => scopedItems.filter((i) => isAlertRelatedActive(i)),
    [scopedItems],
  );
  const trashQueueItems = useMemo(() => {
    let list = scopedItems.filter((i) => isAlertRelatedInTrashWindow(i));
    // Coincidencias · Todas: si sigue activa en otra alerta, no va a Papelera.
    if (isEmbedded && alertFilter === "all") {
      const stillActive = new Set(
        items.filter((i) => isAlertRelatedActive(i)).map((i) => i.tenderId),
      );
      list = list.filter((i) => !stillActive.has(i.tenderId));
    }
    return list;
  }, [scopedItems, items, isEmbedded, alertFilter]);

  /** Sin pendientes, el filtro «Estado envío» sobra. */
  const hasPendingItems = useMemo(
    () => activeQueueItems.some((i) => i.status === "pending"),
    [activeQueueItems],
  );

  useEffect(() => {
    if (!hasPendingItems && statusFilter !== "all") {
      setStatusFilter("all");
    }
  }, [hasPendingItems, statusFilter]);

  const lastSendItems = useMemo(
    () => itemsFromLastSend(activeQueueItems),
    [activeQueueItems],
  );

  const filteredActiveRaw = useMemo(() => {
    let list = activeQueueItems;

    if (lastSendOnly) {
      list = lastSendItems;
    } else if (dateFrom || dateTo) {
      list = list.filter((i) => {
        const day = itemDayKey(i);
        if (!day) return false;
        if (dateFrom && day < dateFrom) return false;
        if (dateTo && day > dateTo) return false;
        return true;
      });
    }

    if (statusFilter === "sent") {
      list = list.filter((i) => i.status === "sent");
    } else if (statusFilter === "pending") {
      list = list.filter((i) => i.status === "pending");
    }

    if (ratingFilter === "rated") {
      list = list.filter((i) => ratings[i.tenderId] != null);
      if (interestFilter === "propia") {
        list = list.filter(
          (i) => ratings[i.tenderId]?.interestKind === "propia",
        );
      } else if (interestFilter === "subcontrata") {
        list = list.filter(
          (i) => ratings[i.tenderId]?.interestKind === "subcontrata",
        );
      }
      if (scoreFilter.length > 0) {
        const allowed = new Set(scoreFilter);
        list = list.filter((i) => {
          const score = ratings[i.tenderId]?.score;
          return score != null && allowed.has(score);
        });
      }
    } else if (ratingFilter === "unrated") {
      list = list.filter((i) => ratings[i.tenderId] == null);
    }

    return list;
  }, [
    activeQueueItems,
    lastSendItems,
    lastSendOnly,
    dateFrom,
    dateTo,
    statusFilter,
    ratingFilter,
    interestFilter,
    scoreFilter,
    ratings,
  ]);

  const activeItems = useMemo(
    () =>
      isEmbedded
        ? dedupeAlertRelatedByTender(activeQueueItems)
        : activeQueueItems,
    [isEmbedded, activeQueueItems],
  );
  const trashItems = useMemo(
    () =>
      isEmbedded
        ? dedupeAlertRelatedByTender(trashQueueItems)
        : trashQueueItems,
    [isEmbedded, trashQueueItems],
  );
  const filteredActive = useMemo(
    () =>
      isEmbedded
        ? dedupeAlertRelatedByTender(filteredActiveRaw)
        : filteredActiveRaw,
    [isEmbedded, filteredActiveRaw],
  );

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
    if (next === "trash") setFiltersOpen(false);
  }

  function onPageSizeChange(next: number) {
    setPageSize(next as PageSize);
    setPage(1);
  }

  /** En Coincidencias, basura/restaurar afecta a todas las colas de esa licitación. */
  function expandQueueIdsForAction(
    queueId: string,
    predicate: (item: AlertRelatedQueueItem) => boolean,
  ): string[] {
    if (!isEmbedded) return [queueId];
    const target = items.find((i) => i.queueId === queueId);
    if (!target) return [queueId];
    const ids = queueIdsForTender(items, target.tenderId, predicate);
    return ids.length > 0 ? ids : [queueId];
  }

  async function onTrashOne(queueId: string) {
    if (actionPending) return;
    const ids = expandQueueIdsForAction(queueId, (i) => i.trashedAt == null);
    setActionPending(true);
    const client = createSupabaseBrowserClient();
    const { error: err } =
      ids.length === 1
        ? await trashOwnAlertRelated(client, { userId, queueId: ids[0]! })
        : await trashOwnAlertRelatedMany(client, { userId, queueIds: ids });
    setActionPending(false);
    if (err) {
      setError(err.message);
      return;
    }
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((i) =>
        ids.includes(i.queueId) ? { ...i, trashedAt: now } : i,
      ),
    );
  }

  async function onRestoreOne(queueId: string) {
    if (actionPending) return;
    const ids = expandQueueIdsForAction(queueId, (i) =>
      isAlertRelatedInTrashWindow(i),
    );
    setActionPending(true);
    const client = createSupabaseBrowserClient();
    const { error: err } =
      ids.length === 1
        ? await restoreOwnAlertRelatedFromTrash(client, {
            userId,
            queueId: ids[0]!,
          })
        : await restoreOwnAlertRelatedManyFromTrash(client, {
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
  }

  async function onEmptyActiveList() {
    if (actionPending || activeItems.length === 0) return;
    setActionPending(true);
    const client = createSupabaseBrowserClient();
    // Coincidencias: vaciar también las colas de otras alertas para esas licitaciones.
    const tenderIds = new Set(activeItems.map((i) => i.tenderId));
    const ids = isEmbedded
      ? items
          .filter((i) => tenderIds.has(i.tenderId) && i.trashedAt == null)
          .map((i) => i.queueId)
      : activeQueueItems.map((i) => i.queueId);
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
      message: alertId
        ? "Se ha vaciado la lista de licitaciones de la alerta."
        : "Se ha vaciado la lista de coincidencias.",
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
    const tenderIds = new Set(trashItems.map((i) => i.tenderId));
    const ids = isEmbedded
      ? items
          .filter(
            (i) =>
              tenderIds.has(i.tenderId) && isAlertRelatedInTrashWindow(i),
          )
          .map((i) => i.queueId)
      : trashQueueItems.map((i) => i.queueId);
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
      `¿Vaciar la papelera (${trashItems.length})? Dejarán de verse aquí (no vuelven a Relacionadas / Coincidencias).`,
    );
    if (!ok) return;
    setActionPending(true);
    const client = createSupabaseBrowserClient();
    const tenderIds = new Set(trashItems.map((i) => i.tenderId));
    const ids = isEmbedded
      ? items
          .filter(
            (i) =>
              tenderIds.has(i.tenderId) && isAlertRelatedInTrashWindow(i),
          )
          .map((i) => i.queueId)
      : trashQueueItems.map((i) => i.queueId);
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

  if (!isOpen || (!isEmbedded && !mounted)) return null;

  const hasAny = items.length > 0;
  /** Título: solo activas (sin papelera). */
  const titleTotalCount = activeItems.length;
  const showEmptyActive = folder === "active" && activeItems.length === 0;
  const showEmptyTrash = folder === "trash" && trashItems.length === 0;
  const emptyNoneMessage = alertId
    ? "Aún no hay licitaciones en cola para esta alerta."
    : "Aún no hay coincidencias en cola para tus alertas.";

  const body = (
    <>
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
          {emptyNoneMessage}
        </p>
      ) : (
        <>
          {(() => {
            const activeFilterCount =
              (lastSendOnly || dateFrom || dateTo ? 1 : 0) +
              (hasPendingItems && statusFilter !== "all" ? 1 : 0) +
              (ratingFilter !== "all" ? 1 : 0) +
              (ratingFilter === "rated" && interestFilter !== "all" ? 1 : 0) +
              (ratingFilter === "rated" && scoreFilter.length > 0 ? 1 : 0) +
              (isEmbedded && alertFilter !== "all" ? 1 : 0);
            const filterToggle = (
              <button
                type="button"
                aria-label={
                  filtersOpen
                    ? "Ocultar filtros"
                    : activeFilterCount > 0
                      ? `Mostrar filtros (${activeFilterCount} activos)`
                      : "Mostrar filtros"
                }
                aria-expanded={filtersOpen}
                title="Filtros"
                onClick={() => setFiltersOpen((o) => !o)}
                className={cn(
                  "relative inline-flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors",
                  filtersOpen || activeFilterCount > 0
                    ? "border-primary bg-primary/10 text-primary-dark"
                    : "border-border bg-surface text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <FilterIcon className="size-4" />
                {activeFilterCount > 0 ? (
                  <span
                    className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[10px] font-bold leading-none text-primary-foreground"
                    aria-hidden
                  >
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
            );
            const showFiltersUi = folder === "active";
            const actionButtons = (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {showFiltersUi ? filterToggle : null}
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
                {showFiltersUi && filtersOpen ? (
                  <div className="mb-2 flex shrink-0 justify-end">
                    {actionButtons}
                  </div>
                ) : null}

                {showFiltersUi && filtersOpen ? (
                  <div className="mb-3 flex shrink-0 flex-col gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-end">
                    <PublicationDateRange
                      idPrefix={`alert-related-${scopeId}-`}
                      label="Tiempo"
                      from={lastSendOnly ? "" : dateFrom}
                      to={lastSendOnly ? "" : dateTo}
                      summaryOverride={lastSendOnly ? "Último envío" : null}
                      presets={["thisWeek", "last7"]}
                      leadingMenuItems={[
                        {
                          label: "Último envío",
                          onSelect: () => {
                            setLastSendOnly(true);
                            setDateFrom("");
                            setDateTo("");
                            setPage(1);
                          },
                        },
                      ]}
                      onChange={(nextFrom, nextTo) => {
                        setLastSendOnly(false);
                        setDateFrom(nextFrom);
                        setDateTo(nextTo);
                        setPage(1);
                      }}
                    />
                    {isEmbedded && alertOptions.length > 0 ? (
                      <label
                        className="flex flex-col gap-1 text-xs text-muted-foreground"
                        style={
                          alertSelectWidthPx != null
                            ? { width: alertSelectWidthPx }
                            : { minWidth: FILTER_ALERT_MIN_PX }
                        }
                      >
                        Alerta
                        <select
                          className="h-9 w-full truncate rounded-md border border-border bg-background px-2 text-sm text-foreground"
                          value={alertFilter}
                          onChange={(e) => {
                            setAlertFilter(e.target.value);
                            setPage(1);
                          }}
                        >
                          <option value="all">Todas</option>
                          {alertOptions.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {hasPendingItems ? (
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
                          <option value="all">Todas</option>
                          <option value="sent">Enviadas</option>
                          <option value="pending">Pendientes</option>
                        </select>
                      </label>
                    ) : null}
                    <label className="flex min-w-[9rem] flex-col gap-1 text-xs text-muted-foreground">
                      Valoración
                      <select
                        className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                        value={ratingFilter}
                        onChange={(e) => {
                          const next = e.target.value as RatingFilter;
                          setRatingFilter(next);
                          if (next !== "rated") {
                            setInterestFilter("all");
                            setScoreFilter([]);
                          }
                          setPage(1);
                        }}
                      >
                        <option value="all">Todas</option>
                        <option value="rated">Valoradas</option>
                        <option value="unrated">Sin valorar</option>
                      </select>
                    </label>
                    {ratingFilter === "rated" ? (
                      <>
                        <label className="flex min-w-[9rem] flex-col gap-1 text-xs text-muted-foreground">
                          Interés
                          <select
                            className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                            value={interestFilter}
                            onChange={(e) => {
                              setInterestFilter(
                                e.target.value as InterestFilter,
                              );
                              setPage(1);
                            }}
                          >
                            <option value="all">Cualquiera</option>
                            <option value="propia">Eficen</option>
                            <option value="subcontrata">Subcontrata</option>
                          </select>
                        </label>
                        <div className="min-w-[9rem]">
                          <ScoreFilterSelect
                            id={`alert-related-${scopeId}-score`}
                            value={scoreFilter}
                            onChange={(next) => {
                              setScoreFilter(next);
                              setPage(1);
                            }}
                            disabled={actionPending}
                          />
                        </div>
                      </>
                    ) : null}
                      </div>
                    ) : null}

                <div className="flex shrink-0 flex-wrap items-start justify-between gap-2 px-1">
                  <div
                    className="flex flex-wrap items-end gap-1"
                    role="tablist"
                    aria-label="Relacionadas o papelera"
                  >
                    <FolderTab
                      active={folder === "active"}
                      label="Relacionadas"
                      count={filteredActive.length}
                      onSelect={() => selectFolder("active")}
                    />
                    <FolderTab
                      active={folder === "trash"}
                      label="Papelera"
                      count={trashItems.length}
                      onSelect={() => selectFolder("trash")}
                    />
                  </div>
                  {!(showFiltersUi && filtersOpen) ? (
                    <div className="flex items-start">{actionButtons}</div>
                  ) : null}
                </div>
              </>
            );
          })()}

          {showEmptyActive ? (
            <div className="relative z-0 overflow-hidden rounded-lg rounded-tl-none border border-border bg-surface/40">
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No hay licitaciones aquí. Las de la papelera siguen disponibles
                en esa pestaña.
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
            <div
              className={cn(
                "relative z-0 flex flex-col overflow-hidden rounded-lg rounded-tl-none border border-border bg-surface/40",
                isEmbedded
                  ? "max-h-[min(70vh,640px)]"
                  : "min-h-0 flex-1",
              )}
            >
              <div
                key={`${folder}-${lastSendOnly}-${dateFrom}-${dateTo}-${statusFilter}-${ratingFilter}-${interestFilter}-${scoreFilter.join(",")}-${page}-${pageSize}`}
                className="min-h-0 flex-1 overflow-y-auto"
              >
                <ul className="divide-y divide-border">
                  {pageItems.map((item) => (
                    <RelatedItemRow
                      key={
                        isEmbedded
                          ? `${item.tenderId}:${folder}`
                          : item.queueId
                      }
                      item={item}
                      rating={ratings[item.tenderId] ?? null}
                      inTrash={folder === "trash"}
                      pending={actionPending}
                      onRatingChange={onRatingChange}
                      onTrash={(id) => void onTrashOne(id)}
                      onRestore={(id) => void onRestoreOne(id)}
                      onNavigate={isEmbedded ? undefined : onClose}
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
    </>
  );

  const undoToast = listUndo ? (
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
  ) : null;

  if (isEmbedded) {
    return (
      <div className="relative rounded-b-xl rounded-t-none border border-border bg-background">
        <div className="border-b border-border px-4 py-3 sm:px-5">
          <h2
            id={`alert-related-title-${scopeId}`}
            className="text-base font-semibold text-foreground"
          >
            Coincidencias
            {!loading && hasAny ? (
              <span className="font-semibold text-muted-foreground">
                {" "}
                ({titleTotalCount})
              </span>
            ) : null}
          </h2>
        </div>
        <div
          ref={contentRef}
          className="flex flex-col px-4 pb-4 pt-3 sm:px-5"
        >
          {body}
        </div>
        {undoToast}
      </div>
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`alert-related-title-${scopeId}`}
        className="relative flex max-h-[min(90vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-xl sm:max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2
              id={`alert-related-title-${scopeId}`}
              className="text-lg font-semibold text-foreground"
            >
              Licitaciones relacionadas
              {!loading && hasAny ? (
                <span className="font-semibold text-muted-foreground">
                  {" "}
                  ({titleTotalCount})
                </span>
              ) : null}
            </h2>
            {alertName ? (
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {alertName}
              </p>
            ) : null}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-5 pb-5 pt-3">{body}</div>
        {undoToast}
      </div>
    </div>,
    document.body,
  );
}
