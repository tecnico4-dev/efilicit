"use client";

import { useEffect, useMemo, useState } from "react";
import type { FavoriteShareRow } from "@/lib/queries";
import { PeerSharesList } from "./peer-shares-list";
import {
  DEFAULT_PAGE_SIZE,
  ListPager,
  type PageSize,
} from "./list-pager";

export const PEER_SHARES_PAGE_SIZE = DEFAULT_PAGE_SIZE;

export function PaginatedPeerShares({
  items,
  showKindBubble = true,
  showDirectionBubble = true,
}: {
  items: FavoriteShareRow[];
  showKindBubble?: boolean;
  showDirectionBubble?: boolean;
}) {
  const total = items.length;
  const showPager = total > PEER_SHARES_PAGE_SIZE;

  const [pageSize, setPageSize] = useState<PageSize>(PEER_SHARES_PAGE_SIZE);
  const [page, setPage] = useState(1);

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

  const panelClass = "rounded-lg rounded-tl-none border border-border";

  if (!showPager) {
    return (
      <div className={`${panelClass} px-4`}>
        <PeerSharesList
          items={pageItems}
          bordered={false}
          noteWide
          showKindBubble={showKindBubble}
          showDirectionBubble={showDirectionBubble}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col overflow-hidden ${panelClass}`}
      style={{ height: "calc(100dvh - 11.5rem)" }}
    >
      <div
        key={`${page}-${pageSize}`}
        className="min-h-0 flex-1 overflow-y-auto px-4"
      >
        <PeerSharesList
          items={pageItems}
          bordered={false}
          noteWide
          showKindBubble={showKindBubble}
          showDirectionBubble={showDirectionBubble}
        />
      </div>
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
    </div>
  );
}
