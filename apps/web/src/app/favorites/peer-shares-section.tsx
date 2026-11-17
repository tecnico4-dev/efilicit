"use client";

import { useMemo, useState } from "react";
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

/**
 * Licitaciones compartidas: listado al mismo ancho/sitio que Común (max-w-7xl);
 * rail de bandeja a la izquierda, fuera de ese ancho, con hueco.
 */
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

  return (
    // Mismo ancho de contenido que Común / favoritos propios (padding del main).
    // El rail se posiciona a la izquierda, fuera, con el mismo hueco (mr-3).
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 right-full z-10 mr-3 hidden w-[8.5rem] md:block">
        <div className="pointer-events-auto sticky top-24 pt-11">
          <ShareDirectionRail
            variant="desktop"
            value={bandeja}
            onChange={setBandeja}
            counts={bandejaCounts}
          />
        </div>
      </div>

      <div className="mb-3 md:hidden">
        <ShareDirectionRail
          variant="mobile"
          value={bandeja}
          onChange={setBandeja}
          counts={bandejaCounts}
        />
      </div>

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
            <PaginatedPeerShares items={propias} showKindBubble={false} />
          )
        }
        subcontratas={
          subcontratas.length === 0 ? (
            emptyKindPanel()
          ) : (
            <PaginatedPeerShares
              items={subcontratas}
              showKindBubble={false}
            />
          )
        }
      />
    </div>
  );
}
