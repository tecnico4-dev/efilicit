"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CriteriaFilterOptionsProp } from "@/components/criteria/criteria-filters";
import type { RecommendationItem } from "@/lib/queries";
import type { SearchCriteria } from "@efilicit/types";
import { cn } from "@/lib/cn";
import { FavoriteKindTabs } from "../favorites/favorite-kind-tabs";
import {
  tenderMatchesFavoriteFilters,
} from "../favorites/favorites-list-filter";
import { PaginatedRecommendations } from "./paginated-recommendations";
import { RecommendationsKanban } from "./recommendations-kanban";
import {
  recommendationsHref,
  type RecommendationsTab,
  type RecommendationsViewMode,
} from "./recommendations-tab";
import { RecommendationsViewToggle } from "./recommendations-view-toggle";

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

/** Página /recommendations: pestañas Todas/Eficen/Sub + filtrar + Lista|Kanban. */
export function RecommendationsSection({
  userId,
  propia,
  subcontrata,
  sinPerfil,
  filterOptions,
  hasComputedAt,
  initialTab = "todas",
  initialView = "lista",
}: {
  userId: string;
  propia: RecommendationItem[];
  subcontrata: RecommendationItem[];
  sinPerfil: RecommendationItem[];
  filterOptions: CriteriaFilterOptionsProp;
  hasComputedAt: boolean;
  initialTab?: RecommendationsTab;
  initialView?: RecommendationsViewMode;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<RecommendationsTab>(initialTab);
  const [criteria, setCriteria] = useState<SearchCriteria | null>(null);
  const [view, setView] = useState<RecommendationsViewMode>(initialView);

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
  const sinPerfilFiltered = useMemo(
    () => filtered.filter((i) => i.profileKind == null),
    [filtered],
  );

  const isKanban = view === "kanban";
  const showKindTabs =
    !isKanban && propias.length > 0 && subcontratas.length > 0;
  const flushTopLeft = showKindTabs;
  const activeTab: RecommendationsTab = showKindTabs ? tab : "todas";

  function replaceListUrl(next: {
    tab?: RecommendationsTab;
    view?: RecommendationsViewMode;
  }) {
    router.replace(
      recommendationsHref({
        tab: next.tab ?? tab,
        view: next.view ?? view,
      }),
      { scroll: false },
    );
  }

  function onTabChange(next: RecommendationsTab) {
    setTab(next);
    replaceListUrl({ tab: next, view: "lista" });
  }

  function onViewChange(next: RecommendationsViewMode) {
    setView(next);
    if (next === "kanban") {
      replaceListUrl({ view: "kanban", tab: "todas" });
      return;
    }
    replaceListUrl({ view: "lista", tab });
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

  const listTodas =
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
    );

  return (
    <FavoriteKindTabs
      ariaLabel="Perfil de recomendación"
      filterOptions={filterOptions}
      appliedCriteria={criteria}
      onApplyFilters={setCriteria}
      tab={activeTab}
      onTabChange={onTabChange}
      hideTabs={isKanban}
      trailingStart={
        <RecommendationsViewToggle view={view} onChange={onViewChange} />
      }
      todasCount={filtered.length}
      propiasCount={propias.length}
      subcontratasCount={subcontratas.length}
      todas={
        isKanban ? (
          filtered.length === 0 ? (
            emptyFilterPanel(false)
          ) : (
            <RecommendationsKanban
              propias={propias}
              subcontratas={subcontratas}
              sinPerfil={sinPerfilFiltered}
            />
          )
        ) : (
          listTodas
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
