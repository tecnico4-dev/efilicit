"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { CriteriaFilterOptionsProp } from "@/components/criteria/criteria-filters";
import type { FavoriteShareRow } from "@/lib/queries";
import type { SearchCriteria } from "@efilicit/types";
import { FavoriteKindTabs } from "./favorite-kind-tabs";
import { tenderMatchesFavoriteFilters } from "./favorites-list-filter";
import { PaginatedPeerShares } from "./paginated-peer-shares";
import {
  ShareDirectionRail,
  type ShareBandeja,
} from "./share-direction-rail";

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

/** Licitaciones compartidas: bandeja + Filtrar + pestañas kind. */
export function PeerSharesSection({
  items,
  filterOptions,
}: {
  items: FavoriteShareRow[];
  filterOptions: CriteriaFilterOptionsProp;
}) {
  const [criteria, setCriteria] = useState<SearchCriteria | null>(null);
  const [bandeja, setBandeja] = useState<ShareBandeja>("todas");

  const byCriteria = useMemo(
    () =>
      items.filter((i) => tenderMatchesFavoriteFilters(i.tender, criteria)),
    [items, criteria],
  );

  const bandejaCounts = useMemo(
    () => ({
      todas: byCriteria.length,
      received: byCriteria.filter((i) => i.direction === "received").length,
      sent: byCriteria.filter((i) => i.direction === "sent").length,
    }),
    [byCriteria],
  );

  const filtered = useMemo(() => {
    if (bandeja === "todas") return byCriteria;
    return byCriteria.filter((i) => i.direction === bandeja);
  }, [byCriteria, bandeja]);

  const propias = useMemo(
    () => filtered.filter((i) => i.kind === "propia"),
    [filtered],
  );
  const subcontratas = useMemo(
    () => filtered.filter((i) => i.kind === "subcontrata"),
    [filtered],
  );

  function wrapPanel(panel: ReactNode) {
    return (
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <ShareDirectionRail
          value={bandeja}
          onChange={setBandeja}
          counts={bandejaCounts}
        />
        <div className="min-w-0 flex-1">{panel}</div>
      </div>
    );
  }

  return (
    <FavoriteKindTabs
      ariaLabel="Tipo en Licitaciones compartidas"
      filterOptions={filterOptions}
      appliedCriteria={criteria}
      onApplyFilters={setCriteria}
      panelWrapper={wrapPanel}
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
