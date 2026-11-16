"use client";

import { useMemo, useState } from "react";
import type { CriteriaFilterOptionsProp } from "@/components/criteria/criteria-filters";
import type { FavoriteShareRow } from "@/lib/queries";
import type { SearchCriteria } from "@efilicit/types";
import { FavoriteKindTabs } from "./favorite-kind-tabs";
import { tenderMatchesFavoriteFilters } from "./favorites-list-filter";
import { PaginatedPeerShares } from "./paginated-peer-shares";

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

/** Licitaciones compartidas: Filtrar + pestañas Todas / Eficen / Subcontrata. */
export function PeerSharesSection({
  items,
  filterOptions,
}: {
  items: FavoriteShareRow[];
  filterOptions: CriteriaFilterOptionsProp;
}) {
  const [criteria, setCriteria] = useState<SearchCriteria | null>(null);

  const filtered = useMemo(
    () =>
      items.filter((i) => tenderMatchesFavoriteFilters(i.tender, criteria)),
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
      ariaLabel="Tipo en Licitaciones compartidas"
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
          <PaginatedPeerShares items={filtered} />
        )
      }
      propias={
        propias.length === 0 ? (
          emptyKindPanel()
        ) : (
          <PaginatedPeerShares items={propias} />
        )
      }
      subcontratas={
        subcontratas.length === 0 ? (
          emptyKindPanel()
        ) : (
          <PaginatedPeerShares items={subcontratas} />
        )
      }
    />
  );
}
