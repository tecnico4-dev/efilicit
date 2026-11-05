"use client";

import { useEffect, useMemo, useState } from "react";
import type { Database } from "@efilicit/types";
import type { CriteriaFilterOptionsProp } from "@/components/criteria/criteria-filters";
import {
  DEFAULT_PAGE_SIZE,
  ListPager,
  type PageSize,
} from "@/app/favorites/list-pager";
import { AlertRowItem } from "./alert-row";

type AlertRow = Database["public"]["Tables"]["alerts"]["Row"];

export const ALERTS_PAGE_SIZE = DEFAULT_PAGE_SIZE;

/**
 * Lista paginada de Mis alertas (mismo pager que favoritos: 10 / 50 / 100).
 * Controles solo si hay más de 10.
 */
export function PaginatedAlertsList({
  alerts,
  filterOptions,
  alertIdsWithQueue,
  municipalityNames = {},
}: {
  alerts: AlertRow[];
  filterOptions: CriteriaFilterOptionsProp;
  alertIdsWithQueue: string[];
  municipalityNames?: Readonly<Record<string, string>>;
}) {
  const queueSet = useMemo(
    () => new Set(alertIdsWithQueue),
    [alertIdsWithQueue],
  );
  const total = alerts.length;
  const showPager = total > ALERTS_PAGE_SIZE;

  const [pageSize, setPageSize] = useState<PageSize>(ALERTS_PAGE_SIZE);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pageItems = useMemo(() => {
    const safe = Math.min(Math.max(page, 1), totalPages);
    const start = (safe - 1) * pageSize;
    return alerts.slice(start, start + pageSize);
  }, [alerts, page, pageSize, totalPages]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function onPageSizeChange(next: number) {
    setPageSize(next as PageSize);
    setPage(1);
  }

  const list = (
    <ul className="divide-y divide-border">
      {pageItems.map((a) => (
        <AlertRowItem
          key={a.id}
          alert={a}
          filterOptions={filterOptions}
          hasRelatedTenders={queueSet.has(a.id)}
          municipalityNames={municipalityNames}
        />
      ))}
    </ul>
  );

  if (!showPager) {
    return (
      <div className="mt-3 border-t border-border px-4 sm:px-5">{list}</div>
    );
  }

  return (
    <div
      className="mt-3 flex flex-col overflow-hidden rounded-lg border border-border"
      style={{ height: "calc(100dvh - 14rem)" }}
    >
      <div
        key={`${page}-${pageSize}`}
        className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-5"
      >
        {list}
      </div>
      <div className="shrink-0 border-t border-border bg-background px-4 py-3 sm:px-5">
        <ListPager
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          showing={pageItems.length}
          total={total}
          itemLabel="alertas"
          ariaPageSizeLabel="Alertas por página"
          onPageChange={setPage}
          onPageSizeChange={onPageSizeChange}
        />
      </div>
    </div>
  );
}
