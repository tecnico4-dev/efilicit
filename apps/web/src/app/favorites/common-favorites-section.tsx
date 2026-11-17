"use client";

import { useMemo, useState } from "react";
import type { CriteriaFilterOptionsProp } from "@/components/criteria/criteria-filters";
import type { SharedFavoriteWithTender } from "@/lib/queries";
import type { SearchCriteria } from "@efilicit/types";
import { cn } from "@/lib/cn";
import { FavoriteKindTabs } from "./favorite-kind-tabs";
import { PaginatedSharedFavorites } from "./paginated-shared-favorites";
import { tenderMatchesFavoriteFilters } from "./favorites-list-filter";

function emptyPanel(flushTopLeft: boolean) {
  return (
    <p
      className={cn(
        "border border-border px-4 py-8 text-center text-sm text-muted-foreground rounded-lg",
        flushTopLeft && "rounded-t-none",
      )}
    >
      Ninguna aún.
    </p>
  );
}

function emptyFilterPanel(flushTopLeft: boolean) {
  return (
    <p
      className={cn(
        "border border-border px-4 py-8 text-center text-sm text-muted-foreground rounded-lg",
        flushTopLeft && "rounded-t-none",
      )}
    >
      Ninguna coincide con los filtros.
    </p>
  );
}

/** Carpeta común con Filtrar (Criteria v1) y pestañas Eficen/Subcontrata. */
export function CommonFavoritesSection({
  items,
  currentUserId,
  filterOptions,
}: {
  items: SharedFavoriteWithTender[];
  currentUserId: string;
  filterOptions: CriteriaFilterOptionsProp;
}) {
  const [criteria, setCriteria] = useState<SearchCriteria | null>(null);

  const filtered = useMemo(
    () =>
      items.filter((i) => tenderMatchesFavoriteFilters(i.tenders, criteria)),
    [items, criteria],
  );
  const propias = useMemo(
    () => filtered.filter((i) => i.kind === "propia"),
    [filtered],
  );
  const subcontratas = useMemo(
    () => filtered.filter((i) => i.kind === "subcontrata"),
    [filtered],
  );

  const showKindTabs = propias.length > 0 && subcontratas.length > 0;
  const flushTopLeft = showKindTabs;

  return (
    <FavoriteKindTabs
      ariaLabel="Tipo en Común"
      filterOptions={filterOptions}
      appliedCriteria={criteria}
      onApplyFilters={setCriteria}
      todasCount={filtered.length}
      propiasCount={propias.length}
      subcontratasCount={subcontratas.length}
      todas={
        filtered.length === 0 ? (
          emptyFilterPanel(flushTopLeft)
        ) : (
          <PaginatedSharedFavorites
            items={filtered}
            currentUserId={currentUserId}
            flushTopLeft={flushTopLeft}
          />
        )
      }
      propias={
        propias.length === 0 ? (
          emptyPanel(flushTopLeft)
        ) : (
          <PaginatedSharedFavorites
            items={propias}
            currentUserId={currentUserId}
            showKindBubble={false}
            flushTopLeft={flushTopLeft}
          />
        )
      }
      subcontratas={
        subcontratas.length === 0 ? (
          emptyPanel(flushTopLeft)
        ) : (
          <PaginatedSharedFavorites
            items={subcontratas}
            currentUserId={currentUserId}
            showKindBubble={false}
            flushTopLeft={flushTopLeft}
          />
        )
      }
    />
  );
}
