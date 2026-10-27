import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState, ErrorState } from "@/components/ui/state-message";
import {
  formatCriteriaSummary,
  parseCriteria,
} from "@/lib/criteria-display";
import { formatCpvListPreview } from "@/lib/cpv";
import { formatRelativeDayMadrid } from "@/lib/datetime";
import type { DigestFrequency, FavoriteWithTender } from "@/lib/queries";
import { formatTenderStatus } from "@/lib/tender-labels";
import type { Database } from "@efilicit/types";
import { ConvertToAlertButton } from "./convert-to-alert-button";
import { RemoveSavedSearchButton } from "./remove-saved-search-button";

export const FAVORITES_PREVIEW_LIMIT = 5;

type SavedSearchRow = Database["public"]["Tables"]["saved_searches"]["Row"];

export function formatMoney(value: number | null, currency: string): string {
  if (value == null) return "—";
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

export function searchHrefFromCriteria(
  criteria: ReturnType<typeof parseCriteria>,
  from?: "favorites" | "favorites-searches",
): string {
  const params = new URLSearchParams();
  if (criteria.keywords?.length) {
    params.set("q", criteria.keywords.join(" "));
  }
  if (criteria.cpv_codes?.length) {
    for (const code of criteria.cpv_codes) params.append("cpv", code);
    if (criteria.cpv_codes.length >= 2 && criteria.cpv_match === "all") {
      params.set("cpv_match", "all");
    }
  }
  if (criteria.estimated_value_min != null) {
    params.set("min", String(criteria.estimated_value_min));
  }
  if (criteria.estimated_value_max != null) {
    params.set("max", String(criteria.estimated_value_max));
  }
  if (criteria.statuses?.[0]) params.set("status", criteria.statuses[0]);
  if (criteria.procedure_types?.[0]) {
    params.set("procedure", criteria.procedure_types[0]);
  }
  if (criteria.contract_types?.[0]) {
    params.set("contract_type", criteria.contract_types[0]);
  }
  if (criteria.publication_date_from) {
    params.set("pub_from", criteria.publication_date_from);
  }
  if (criteria.publication_date_to) {
    params.set("pub_to", criteria.publication_date_to);
  }
  if (criteria.open_for_submission === true) {
    params.set("en_plazo", "1");
  }
  const ccaa = criteria.geography?.ccaa_codes?.[0];
  if (ccaa) params.set("ccaa", ccaa);
  const municipality = criteria.geography?.municipality_codes?.[0];
  if (municipality) params.set("municipality", municipality);
  if (from) params.set("from", from);
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}

export function FavoriteTenderList({
  favorites,
  from = "favorites",
  bordered = true,
}: {
  favorites: FavoriteWithTender[];
  /** Origen del enlace a la ficha (para el «volver»). */
  from?: "favorites" | "favorites-tenders";
  /** Línea superior (false dentro de un recuadro con borde propio). */
  bordered?: boolean;
}) {
  return (
    <ul
      className={
        bordered
          ? "divide-y divide-border border-t border-border"
          : "divide-y divide-border"
      }
    >
      {favorites.map((fav) => {
        const tender = fav.tenders;
        if (!tender) {
          return (
            <li key={fav.id} className="py-4 text-sm text-muted-foreground">
              Licitación no disponible
            </li>
          );
        }
        return (
          <li key={fav.id} className="py-4">
            <div className="flex items-baseline justify-between gap-3">
              <Link
                href={`/tenders/${tender.id}?from=${from}`}
                className="min-w-0 text-base font-medium text-foreground hover:text-link hover:underline"
              >
                {tender.title}
              </Link>
              {tender.last_seen_at ? (
                <p className="shrink-0 text-xs text-muted-foreground sm:text-sm">
                  Datos actualizados:{" "}
                  <span className="tabular-nums">
                    {formatRelativeDayMadrid(tender.last_seen_at)}
                  </span>
                </p>
              ) : null}
            </div>
            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <div>
                <dt className="inline text-muted-foreground">Importe: </dt>
                <dd className="inline">
                  {formatMoney(tender.estimated_value, tender.currency)}
                </dd>
              </div>
              <div>
                <dt className="inline text-muted-foreground">CPV: </dt>
                <dd className="inline font-mono">
                  {formatCpvListPreview(tender.cpv_codes)}
                </dd>
              </div>
              <div>
                <dt className="inline text-muted-foreground">Estado: </dt>
                <dd className="inline">{formatTenderStatus(tender.status)}</dd>
              </div>
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

export function SavedSearchList({
  searches,
  userId,
  digestFrequency,
  searchFrom = "favorites",
  bordered = true,
}: {
  searches: SavedSearchRow[];
  userId: string;
  digestFrequency: DigestFrequency;
  /** Origen al abrir en búsqueda (para el «volver»). */
  searchFrom?: "favorites" | "favorites-searches";
  /** Línea superior (false dentro de un recuadro con borde propio). */
  bordered?: boolean;
}) {
  return (
    <ul
      className={
        bordered
          ? "divide-y divide-border border-t border-border"
          : "divide-y divide-border"
      }
    >
      {searches.map((s) => {
        const criteria = parseCriteria(s.criteria);
        return (
          <li key={s.id} className="py-4 text-sm">
            <p className="font-medium text-foreground">{s.name}</p>
            <p className="mt-1 text-muted-foreground">
              {formatCriteriaSummary(criteria)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <Link
                href={searchHrefFromCriteria(criteria, searchFrom)}
                className="font-medium text-link hover:underline"
              >
                Abrir en búsqueda
              </Link>
              <ConvertToAlertButton
                userId={userId}
                digestFrequency={digestFrequency}
                defaultName={s.name}
                criteria={criteria}
              />
              <RemoveSavedSearchButton
                searchId={s.id}
                userId={userId}
                name={s.name}
                criteria={criteria}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Lista recortada con fade + «Mostrar más» solo si hay más del límite. */
export function PreviewSection({
  title,
  emptyMessage,
  error,
  totalCount,
  moreHref,
  children,
  className,
}: {
  title: string;
  emptyMessage: ReactNode;
  error: string | null;
  totalCount: number;
  moreHref: string;
  children: ReactNode;
  className?: string;
}) {
  const showMore = totalCount > FAVORITES_PREVIEW_LIMIT;

  return (
    <section className={className ?? "mt-16 first:mt-10"}>
      <h2 className="text-xl font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {error ? (
        <ErrorState className="mt-4">{error}</ErrorState>
      ) : totalCount === 0 ? (
        <EmptyState className="mt-4">{emptyMessage}</EmptyState>
      ) : (
        <div className="mt-4">
          <div className={showMore ? "relative" : undefined}>
            {children}
            {showMore ? (
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background to-transparent"
                aria-hidden
              />
            ) : null}
          </div>
          {showMore ? (
            <p className="relative z-10 py-3 text-center">
              <Link
                href={moreHref}
                className="text-sm font-medium text-primary hover:text-primary-dark hover:underline"
              >
                Mostrar más
              </Link>
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
