"use client";

import { useMemo, useState } from "react";
import type { CriteriaFilterOptionsProp } from "@/components/criteria/criteria-filters";
import type { SharedFavoriteWithTender } from "@/lib/queries";
import type { SearchCriteria } from "@efilicit/types";
import { FavoriteKindTabs } from "./favorite-kind-tabs";
import { PaginatedSharedFavorites } from "./paginated-shared-favorites";
import { tenderMatchesFavoriteFilters } from "./favorites-list-filter";

function emptyKindPanel() {
  return (
    <p className="rounded-lg rounded-tl-none border border-border px-4 py-8 text-center text-sm text-muted-foreground">
      Ninguna aún.
    </p>
  );
}

function emptyFilterPanel() {
  return (
    <p className="rounded-lg rounded-tl-none border border-border px-4 py-8 text-center text-sm text-muted-foreground">
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
          emptyFilterPanel()
        ) : (
          <PaginatedSharedFavorites
            items={filtered}
            currentUserId={currentUserId}
          />
        )
      }
      propias={
        propias.length === 0 ? (
          emptyKindPanel()
        ) : (
          <PaginatedSharedFavorites
            items={propias}
            currentUserId={currentUserId}
          />
        )
      }
      subcontratas={
        subcontratas.length === 0 ? (
          emptyKindPanel()
        ) : (
          <PaginatedSharedFavorites
            items={subcontratas}
            currentUserId={currentUserId}
          />
        )
      }
    />
  );
}
