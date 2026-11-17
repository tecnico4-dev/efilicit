"use client";

import { useMemo } from "react";
import { formatDateTimeMadrid } from "@/lib/datetime";
import type { RecommendationItem } from "@/lib/queries";
import { cn } from "@/lib/cn";
import { PaginatedRecommendations } from "./paginated-recommendations";
import { RecommendationKindTabs } from "./recommendation-kind-tabs";

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

/** Página /recommendations: pestañas Todas/Eficen/Sub + paginación. */
export function RecommendationsSection({
  userId,
  propia,
  subcontrata,
  computedAt,
}: {
  userId: string;
  propia: RecommendationItem[];
  subcontrata: RecommendationItem[];
  computedAt: string | null;
}) {
  const todas = useMemo(
    () =>
      [...propia, ...subcontrata].sort((a, b) => b.score - a.score),
    [propia, subcontrata],
  );

  const showKindTabs = propia.length > 0 && subcontrata.length > 0;
  const flushTopLeft = showKindTabs;

  if (todas.length === 0) {
    return (
      <p className="mt-6 text-sm text-muted-foreground">
        {computedAt
          ? "Ninguna recomendación por encima del umbral ahora."
          : "Aún no hay cálculo de recomendaciones."}
      </p>
    );
  }

  return (
    <div className="mt-6">
      <RecommendationKindTabs
        ariaLabel="Perfil de recomendación"
        todasCount={todas.length}
        propiasCount={propia.length}
        subcontratasCount={subcontrata.length}
        todas={
          <PaginatedRecommendations
            items={todas}
            userId={userId}
            showKindBubble
            flushTopLeft={flushTopLeft}
          />
        }
        propias={
          propia.length === 0 ? (
            emptyPanel(flushTopLeft)
          ) : (
            <PaginatedRecommendations
              items={propia}
              userId={userId}
              showKindBubble={false}
              flushTopLeft={flushTopLeft}
            />
          )
        }
        subcontratas={
          subcontrata.length === 0 ? (
            emptyPanel(flushTopLeft)
          ) : (
            <PaginatedRecommendations
              items={subcontrata}
              userId={userId}
              showKindBubble={false}
              flushTopLeft={flushTopLeft}
            />
          )
        }
      />

      {computedAt ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Actualizado el {formatDateTimeMadrid(computedAt)}
        </p>
      ) : null}
    </div>
  );
}
