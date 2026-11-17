"use client";

import { useMemo, useState } from "react";
import type { CriteriaFilterOptionsProp } from "@/components/criteria/criteria-filters";
import type {
  FavoriteWithTender,
  SharedFavoriteOwnerInfo,
} from "@/lib/queries";
import type { SearchCriteria } from "@efilicit/types";
import { FavoriteKindTabs } from "./favorite-kind-tabs";
import { PaginatedFavoriteTenders } from "./paginated-favorite-tenders";
import { tenderMatchesFavoriteFilters } from "./favorites-list-filter";
import { cn } from "@/lib/cn";

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

/** Listado propio con Filtrar (Criteria v1) y pestañas Eficen/Subcontrata. */
export function OwnFavoritesSection({
  favorites,
  userId,
  sharedOwners,
  filterOptions,
}: {
  favorites: FavoriteWithTender[];
  userId: string;
  sharedOwners: Readonly<Record<string, SharedFavoriteOwnerInfo>>;
  filterOptions: CriteriaFilterOptionsProp;
}) {
  const [criteria, setCriteria] = useState<SearchCriteria | null>(null);

  const filtered = useMemo(
    () =>
      favorites.filter((f) =>
        tenderMatchesFavoriteFilters(f.tenders, criteria),
      ),
    [favorites, criteria],
  );
  const propias = useMemo(
    () => filtered.filter((f) => f.kind === "propia"),
    [filtered],
  );
  const subcontratas = useMemo(
    () => filtered.filter((f) => f.kind === "subcontrata"),
    [filtered],
  );

  const showKindTabs = propias.length > 0 && subcontratas.length > 0;
  const flushTopLeft = showKindTabs;

  return (
    <FavoriteKindTabs
      ariaLabel="Tipo de favorito"
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
          <PaginatedFavoriteTenders
            favorites={filtered}
            from="favorites-tenders"
            shareUserId={userId}
            sharedOwners={sharedOwners}
            flushTopLeft={flushTopLeft}
          />
        )
      }
      propias={
        propias.length === 0 ? (
          emptyPanel(flushTopLeft)
        ) : (
          <PaginatedFavoriteTenders
            favorites={propias}
            from="favorites-tenders"
            shareUserId={userId}
            sharedOwners={sharedOwners}
            showKindBubble={false}
            flushTopLeft={flushTopLeft}
          />
        )
      }
      subcontratas={
        subcontratas.length === 0 ? (
          emptyPanel(flushTopLeft)
        ) : (
          <PaginatedFavoriteTenders
            favorites={subcontratas}
            from="favorites-tenders"
            shareUserId={userId}
            sharedOwners={sharedOwners}
            showKindBubble={false}
            flushTopLeft={flushTopLeft}
          />
        )
      }
    />
  );
}
