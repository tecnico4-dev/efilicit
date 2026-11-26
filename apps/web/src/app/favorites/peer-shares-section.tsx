"use client";

import { useEffect, useMemo, useState } from "react";
import type { CriteriaFilterOptionsProp } from "@/components/criteria/criteria-filters";
import type { FavoriteShareRow } from "@/lib/queries";
import type { SearchCriteria } from "@efilicit/types";
import { cn } from "@/lib/cn";
import { FavoriteKindTabs } from "./favorite-kind-tabs";
import { tenderMatchesFavoriteFilters } from "./favorites-list-filter";
import { PaginatedPeerShares } from "./paginated-peer-shares";
import {
  ShareDirectionRail,
  type ShareBandeja,
} from "./share-direction-rail";

function emptyPanel(flushTopLeft: boolean) {
  return (
    <p
      className={cn(
        "border border-border px-4 py-8 text-center text-sm text-muted-foreground rounded-lg",
        flushTopLeft && "rounded-tl-none",
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
        flushTopLeft && "rounded-tl-none",
      )}
    >
      Ninguna coincide con los filtros.
    </p>
  );
}

/**
 * Licitaciones compartidas: listado al mismo ancho/sitio que Común;
 * rail de bandeja solo si hay enviadas y recibidas.
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

  /** Como pestañas kind: solo si hay ambos sentidos. */
  const showBandejaRail =
    bandejaCounts.sent > 0 && bandejaCounts.received > 0;

  useEffect(() => {
    if (!showBandejaRail && bandeja !== "todas") {
      setBandeja("todas");
    }
  }, [showBandejaRail, bandeja]);

  const effectiveBandeja: ShareBandeja = showBandejaRail ? bandeja : "todas";

  const filtered = useMemo(() => {
    if (effectiveBandeja === "todas") return byCriteria;
    return byCriteria.filter((i) => i.direction === effectiveBandeja);
  }, [byCriteria, effectiveBandeja]);

  const propias = useMemo(
    () => filtered.filter((i) => i.kind === "propia"),
    [filtered],
  );
  const subcontratas = useMemo(
    () => filtered.filter((i) => i.kind === "subcontrata"),
    [filtered],
  );

  /** Circulito Enviada/Recibida: en Todas o si no hay rail. */
  const showDirectionBubble =
    !showBandejaRail || effectiveBandeja === "todas";

  /** Pestañas kind según el listado de la bandeja actual. */
  const showKindTabs = propias.length > 0 && subcontratas.length > 0;
  const flushTopLeft = showKindTabs;

  return (
    <div className="relative">
      {showBandejaRail ? (
        <>
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
        </>
      ) : null}

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
            emptyFilterPanel(flushTopLeft)
          ) : (
            <PaginatedPeerShares
              items={filtered}
              showDirectionBubble={showDirectionBubble}
              flushTopLeft={flushTopLeft}
            />
          )
        }
        propias={
          propias.length === 0 ? (
            emptyPanel(flushTopLeft)
          ) : (
            <PaginatedPeerShares
              items={propias}
              showKindBubble={false}
              showDirectionBubble={showDirectionBubble}
              flushTopLeft={flushTopLeft}
            />
          )
        }
        subcontratas={
          subcontratas.length === 0 ? (
            emptyPanel(flushTopLeft)
          ) : (
            <PaginatedPeerShares
              items={subcontratas}
              showKindBubble={false}
              showDirectionBubble={showDirectionBubble}
              flushTopLeft={flushTopLeft}
            />
          )
        }
      />
    </div>
  );
}
