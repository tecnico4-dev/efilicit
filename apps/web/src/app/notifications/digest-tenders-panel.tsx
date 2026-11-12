"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { TenderStarRating } from "@/components/tenders/tender-star-rating";
import { formatCpvListPreview } from "@/lib/cpv";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  deleteOwnTenderRating,
  listOwnAlertInterestKindsForTenders,
  listOwnTenderRatings,
  listTendersForDigestInbox,
  markOwnDigestInboxRead,
  upsertOwnTenderRating,
  type DigestTenderListItem,
  type TenderInterestKind,
  type TenderRating,
} from "@/lib/queries";
import { formatTenderStatus } from "@/lib/tender-labels";
import { formatMoney } from "@/app/favorites/favorites-shared";
import {
  DEFAULT_PAGE_SIZE,
  ListPager,
  type PageSize,
} from "@/app/favorites/list-pager";

function TenderRow({
  item,
  rating,
  defaultInterestKind,
  onRatingChange,
  onNavigate,
}: {
  item: DigestTenderListItem;
  rating: TenderRating | null;
  defaultInterestKind?: TenderInterestKind | null;
  onRatingChange: (
    tenderId: string,
    next: TenderRating | null,
  ) => Promise<void>;
  onNavigate: () => void;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-4">
      <div className="min-w-0 flex-1">
        {!item.available ? (
          <p className="text-base font-medium text-muted-foreground">
            {item.title}
          </p>
        ) : (
          <>
            <Link
              href={
                defaultInterestKind
                  ? `/tenders/${item.tenderId}?from=notifications&interest=${defaultInterestKind}`
                  : `/tenders/${item.tenderId}?from=notifications`
              }
              className="text-base font-medium text-foreground hover:text-link hover:underline"
              onClick={onNavigate}
            >
              {item.title}
            </Link>
            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <div>
                <dt className="inline">Importe: </dt>
                <dd className="inline">
                  {formatMoney(item.estimated_value, item.currency)}
                </dd>
              </div>
              <div>
                <dt className="inline">CPV: </dt>
                <dd className="inline font-mono">
                  {formatCpvListPreview(item.cpv_codes)}
                </dd>
              </div>
              <div>
                <dt className="inline">Estado: </dt>
                <dd className="inline">{formatTenderStatus(item.status)}</dd>
              </div>
            </dl>
          </>
        )}
      </div>
      {item.available ? (
        <div className="shrink-0 pt-0.5">
          <TenderStarRating
            rating={rating}
            defaultInterestKind={defaultInterestKind}
            onChange={(next) => onRatingChange(item.tenderId, next)}
          />
        </div>
      ) : null}
    </li>
  );
}

/**
 * Modal: licitaciones incluidas en un digest email (lista plana, sin carpetas).
 * Paginación 10/50/100 cuando toca; scroll siempre. Estrellas 1–5 por ítem.
 */
export function DigestTendersPanel({
  digestId,
  userId,
  tenderIds,
  title,
  subtitle,
  open,
  onClose,
}: {
  digestId: string;
  userId: string;
  tenderIds: string[];
  title: string;
  subtitle: string;
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<DigestTenderListItem[]>([]);
  const [ratings, setRatings] = useState<Record<string, TenderRating>>({});
  const [interestByTender, setInterestByTender] = useState<
    Record<string, TenderInterestKind>
  >({});
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

  const tenderIdsKey = tenderIds.join(",");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPage(1);
    setRatings({});
    setInterestByTender({});
    const ids = tenderIdsKey ? tenderIdsKey.split(",") : [];
    const client = createSupabaseBrowserClient();
    void markOwnDigestInboxRead(client, { userId, digestId }).then(() => {
      /* badge se refresca al cerrar / router.refresh desde el padre */
    });

    void (async () => {
      const [tendersResult, ratingsResult, interestResult] = await Promise.all([
        listTendersForDigestInbox(client, { tenderIds: ids }),
        listOwnTenderRatings(client, { userId, tenderIds: ids }),
        listOwnAlertInterestKindsForTenders(client, {
          userId,
          tenderIds: ids,
        }),
      ]);
      if (cancelled) return;
      setLoading(false);
      if (tendersResult.error) {
        setError(tendersResult.error.message);
        setItems([]);
        return;
      }
      setItems(tendersResult.data);
      if (ratingsResult.error) {
        setError(ratingsResult.error.message);
        return;
      }
      setRatings(ratingsResult.data);
      if (!interestResult.error) {
        setInterestByTender(interestResult.data);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, digestId, userId, tenderIdsKey]);

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

  const total = items.length;
  const showPager = total > DEFAULT_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pageItems = useMemo(() => {
    const safe = Math.min(Math.max(page, 1), totalPages);
    const start = (safe - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize, totalPages]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

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
        aria-labelledby={`digest-tenders-title-${digestId}`}
        className="flex max-h-[min(90vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-xl sm:max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2
              id={`digest-tenders-title-${digestId}`}
              className="text-lg font-semibold text-foreground"
            >
              {title}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
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
              No hay licitaciones en este envío.
            </p>
          ) : (
            <div className="relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-surface/40">
              <div
                key={`${page}-${pageSize}`}
                className="min-h-0 flex-1 overflow-y-auto"
              >
                <ul className="divide-y divide-border">
                  {pageItems.map((item) => (
                    <TenderRow
                      key={item.tenderId}
                      item={item}
                      rating={ratings[item.tenderId] ?? null}
                      defaultInterestKind={
                        interestByTender[item.tenderId] ?? null
                      }
                      onRatingChange={onRatingChange}
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
        </div>
      </div>
    </div>,
    document.body,
  );
}
