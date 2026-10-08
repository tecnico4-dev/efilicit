import Link from "next/link";
import type { ReactNode } from "react";
import {
  formatCriteriaSummary,
  parseCriteria,
} from "@/lib/criteria-display";
import type { FavoriteWithTender } from "@/lib/queries";
import type { Database } from "@efilicit/types";

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
): string {
  const params = new URLSearchParams();
  if (criteria.keywords?.length) {
    params.set("q", criteria.keywords.join(" "));
  }
  if (criteria.cpv_codes?.[0]) {
    params.set("cpv", criteria.cpv_codes[0]);
  }
  if (criteria.estimated_value_min != null) {
    params.set("min", String(criteria.estimated_value_min));
  }
  if (criteria.estimated_value_max != null) {
    params.set("max", String(criteria.estimated_value_max));
  }
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}

export function FavoriteTenderList({
  favorites,
}: {
  favorites: FavoriteWithTender[];
}) {
  return (
    <ul className="divide-y divide-border border-t border-border">
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
            <Link
              href={`/tenders/${tender.id}?from=favorites`}
              className="text-base font-medium text-foreground hover:text-link hover:underline"
            >
              {tender.title}
            </Link>
            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <div>
                <dt className="inline">Importe · </dt>
                <dd className="inline">
                  {formatMoney(tender.estimated_value, tender.currency)}
                </dd>
              </div>
              <div>
                <dt className="inline">CPV · </dt>
                <dd className="inline font-mono">{tender.cpv_code ?? "—"}</dd>
              </div>
              {tender.status ? (
                <div>
                  <dt className="inline">Estado · </dt>
                  <dd className="inline">{tender.status}</dd>
                </div>
              ) : null}
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

export function SavedSearchList({
  searches,
}: {
  searches: SavedSearchRow[];
}) {
  return (
    <ul className="divide-y divide-border border-t border-border">
      {searches.map((s) => {
        const criteria = parseCriteria(s.criteria);
        return (
          <li key={s.id} className="py-4 text-sm">
            <p className="font-medium text-foreground">{s.name}</p>
            <p className="mt-1 text-muted-foreground">
              {formatCriteriaSummary(criteria)}
            </p>
            <Link
              href={searchHrefFromCriteria(criteria)}
              className="mt-2 inline-block text-sm font-medium text-link hover:underline"
            >
              Abrir en búsqueda
            </Link>
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
}: {
  title: string;
  emptyMessage: string;
  error: string | null;
  totalCount: number;
  moreHref: string;
  children: ReactNode;
}) {
  const showMore = totalCount > FAVORITES_PREVIEW_LIMIT;

  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : totalCount === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="mt-4">
          <div className={showMore ? "relative" : undefined}>
            {children}
            {showMore ? (
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent"
                aria-hidden
              />
            ) : null}
          </div>
          {showMore ? (
            <p className="mt-2">
              <Link
                href={moreHref}
                className="text-sm font-medium text-link hover:underline"
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
