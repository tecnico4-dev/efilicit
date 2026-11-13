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
          emptyFilterPanel()
        ) : (
          <PaginatedFavoriteTenders
            favorites={filtered}
            from="favorites-tenders"
            shareUserId={userId}
            sharedOwners={sharedOwners}
          />
        )
      }
      propias={
        propias.length === 0 ? (
          emptyKindPanel()
        ) : (
          <PaginatedFavoriteTenders
            favorites={propias}
            from="favorites-tenders"
            shareUserId={userId}
            sharedOwners={sharedOwners}
          />
        )
      }
      subcontratas={
        subcontratas.length === 0 ? (
          emptyKindPanel()
        ) : (
          <PaginatedFavoriteTenders
            favorites={subcontratas}
            from="favorites-tenders"
            shareUserId={userId}
            sharedOwners={sharedOwners}
          />
        )
      }
    />
  );
}
