"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { CriteriaFilterOptionsProp } from "@/components/criteria/criteria-filters";
import type { RecommendationItem } from "@/lib/queries";
import type { SearchCriteria } from "@efilicit/types";
import { cn } from "@/lib/cn";
import { FavoriteKindTabs } from "../favorites/favorite-kind-tabs";
import {
  tenderMatchesFavoriteFilters,
} from "../favorites/favorites-list-filter";
import { PaginatedRecommendations } from "./paginated-recommendations";
import { type RecommendationsTab } from "./recommendations-tab";

function emptyPanel(flushTopLeft: boolean) {
  return (
    <p
      className={cn(
        "rounded-lg border border-border px-4 py-8 text-center text-sm text-muted-foreground",
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
        "rounded-lg border border-border px-4 py-8 text-center text-sm text-muted-foreground",
        flushTopLeft && "rounded-tl-none",
      )}
    >
      Ninguna coincide con los filtros.
    </p>
  );
}

function recommendationAsTenderSlice(item: RecommendationItem) {
  return {
    title: item.title,
    status: item.status,
    procedure_type: item.procedureType,
    contract_type: item.contractType,
    estimated_value: item.estimatedValue,
    cpv_codes: item.cpvCodes,
    publication_date: item.publicationDate,
    deadline_at: item.deadlineAt,
  };
}

/** Página /recommendations: pestañas Todas/Eficen/Sub + filtrar + paginación. */
export function RecommendationsSection({
  userId,
  propia,
  subcontrata,
  sinPerfil,
  filterOptions,
  hasComputedAt,
  initialTab = "todas",
}: {
  userId: string;
  propia: RecommendationItem[];
  subcontrata: RecommendationItem[];
  sinPerfil: RecommendationItem[];
  filterOptions: CriteriaFilterOptionsProp;
  hasComputedAt: boolean;
  initialTab?: RecommendationsTab;
}) {
  const router = useRouter();
  const pathname = usePathname() || "/recommendations";
  const [tab, setTab] = useState<RecommendationsTab>(initialTab);
  const [criteria, setCriteria] = useState<SearchCriteria | null>(null);

  const todasRaw = useMemo(
    () =>
      [...propia, ...subcontrata, ...sinPerfil].sort(
        (a, b) => b.score - a.score,
      ),
    [propia, subcontrata, sinPerfil],
  );

  const filtered = useMemo(
    () =>
      todasRaw.filter((item) =>
        tenderMatchesFavoriteFilters(
          recommendationAsTenderSlice(item),
          criteria,
        ),
      ),
    [todasRaw, criteria],
  );
  const propias = useMemo(
    () => filtered.filter((i) => i.profileKind === "propia"),
    [filtered],
  );
  const subcontratas = useMemo(
    () => filtered.filter((i) => i.profileKind === "subcontrata"),
    [filtered],
  );

  const showKindTabs = propias.length > 0 && subcontratas.length > 0;
  const flushTopLeft = showKindTabs;
  const activeTab: RecommendationsTab = showKindTabs ? tab : "todas";

  function onTabChange(next: RecommendationsTab) {
    setTab(next);
    const href =
      next === "propia" || next === "subcontrata"
        ? `${pathname}?tab=${next}`
        : pathname;
    router.replace(href, { scroll: false });
  }

  if (todasRaw.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {hasComputedAt
          ? "Ninguna recomendación por encima del umbral ahora."
          : "Aún no hay cálculo de recomendaciones."}
      </p>
    );
  }

  return (
    <FavoriteKindTabs
      ariaLabel="Perfil de recomendación"
      filterOptions={filterOptions}
      appliedCriteria={criteria}
      onApplyFilters={setCriteria}
      tab={activeTab}
      onTabChange={onTabChange}
      todasCount={filtered.length}
      propiasCount={propias.length}
      subcontratasCount={subcontratas.length}
      todas={
        filtered.length === 0 ? (
          emptyFilterPanel(flushTopLeft)
        ) : (
          <PaginatedRecommendations
            items={filtered}
            userId={userId}
            showKindBubble
            flushTopLeft={flushTopLeft}
            listTab="todas"
          />
        )
      }
      propias={
        propias.length === 0 ? (
          emptyPanel(flushTopLeft)
        ) : (
          <PaginatedRecommendations
            items={propias}
            userId={userId}
            showKindBubble={false}
            flushTopLeft={flushTopLeft}
            listTab="propia"
          />
        )
      }
      subcontratas={
        subcontratas.length === 0 ? (
          emptyPanel(flushTopLeft)
        ) : (
          <PaginatedRecommendations
            items={subcontratas}
            userId={userId}
            showKindBubble={false}
            flushTopLeft={flushTopLeft}
            listTab="subcontrata"
          />
        )
      }
    />
  );
}
