import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState, ErrorState } from "@/components/ui/state-message";
import {
  formatCriteriaSummary,
  parseCriteria,
} from "@/lib/criteria-display";
import { formatCpvListPreview } from "@/lib/cpv";
import {
  type DigestFrequency,
  type FavoriteWithTender,
  type SharedFavoriteOwnerInfo,
  type SharedFavoriteWithTender,
} from "@/lib/queries";
import { FavoriteKindBubble } from "@/components/favorites/favorite-kind-bubble";
import { formatTenderStatus } from "@/lib/tender-labels";
import type { Database } from "@efilicit/types";
import { ConvertToAlertButton } from "./convert-to-alert-button";
import { RemoveSavedSearchButton } from "./remove-saved-search-button";
import { RemoveSharedFavoriteButton } from "./remove-shared-favorite-button";
import { ShareToCommonButton } from "./share-to-common-button";

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
  if (criteria.statuses?.length) {
    for (const s of criteria.statuses) params.append("status", s);
  }
  if (criteria.procedure_types?.length) {
    for (const p of criteria.procedure_types) params.append("procedure", p);
  }
  if (criteria.contract_types?.length) {
    for (const c of criteria.contract_types) params.append("contract_type", c);
  }
  if (criteria.publication_date_from) {
    params.set("pub_from", criteria.publication_date_from);
  }
  if (criteria.publication_date_to) {
    params.set("pub_to", criteria.publication_date_to);
  }
  if (criteria.open_for_submission === false) {
    params.set("en_plazo", "0");
  } else {
    params.set("en_plazo", "1");
  }
  if (criteria.geography?.ccaa_codes?.length) {
    for (const c of criteria.geography.ccaa_codes) params.append("ccaa", c);
  }
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
  shareUserId,
  sharedOwners,
}: {
  favorites: FavoriteWithTender[];
  /** Origen del enlace a la ficha (para el «volver»). */
  from?: "favorites" | "favorites-tenders";
  /** Línea superior (false dentro de un recuadro con borde propio). */
  bordered?: boolean;
  /** Si se pasa, muestra avión «Añadir a Común» (solo listado ampliado). */
  shareUserId?: string;
  /** Quién compartió cada tender ya en Común (pinta el avión). */
  sharedOwners?: Readonly<Record<string, SharedFavoriteOwnerInfo>>;
}) {
  const showShare = Boolean(shareUserId);

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
          <li key={fav.id} className="flex items-start gap-3 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/tenders/${tender.id}?from=${from}`}
                  className="text-base font-medium text-foreground hover:text-link hover:underline"
                >
                  {tender.title}
                </Link>
                <FavoriteKindBubble kind={fav.kind} />
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
            </div>
            {showShare && shareUserId ? (
              <ShareToCommonButton
                userId={shareUserId}
                tenderId={tender.id}
                tenderTitle={tender.title}
                kind={fav.kind}
                alreadySharedOwner={sharedOwners?.[tender.id] ?? null}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function formatSharedWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-ES", {
      timeZone: "Europe/Madrid",
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function SharedFavoriteList({
  items,
  from = "favorites",
  bordered = true,
  showRemove = false,
  noteWide = false,
  currentUserId,
}: {
  items: SharedFavoriteWithTender[];
  from?: "favorites" | "favorites-common";
  bordered?: boolean;
  showRemove?: boolean;
  /** Página Común: la nota crece con el hueco; hub favoritos: ancho fijo corto. */
  noteWide?: boolean;
  /** Necesario con `showRemove` (aviso si quitas la de otro). */
  currentUserId?: string;
}) {
  return (
    <ul
      className={
        bordered
          ? "divide-y divide-border border-t border-border"
          : "divide-y divide-border"
      }
    >
      {items.map((item) => {
        const tender = item.tenders;
        if (!tender) {
          return (
            <li
              key={item.tender_id}
              className="py-4 text-sm text-muted-foreground"
            >
              Licitación no disponible
            </li>
          );
        }
        const who = item.added_by_display_name?.trim() || "Usuario";
        const note = item.notes?.trim() || "";
        return (
          <li key={item.tender_id} className="flex items-start gap-3 py-4">
            <div className="min-w-0 flex-1">
              <Link
                href={`/tenders/${tender.id}?from=${from}`}
                className="text-base font-medium text-foreground hover:text-link hover:underline"
              >
                {tender.title}
              </Link>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <FavoriteKindBubble kind={item.kind} />
                    <p className="text-xs text-muted-foreground">
                      Añadida por {who} ({formatSharedWhen(item.created_at)})
                    </p>
                  </div>
                  <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <div>
                      <dt className="inline text-muted-foreground">Importe: </dt>
                      <dd className="inline">
                        {formatMoney(
                          tender.estimated_value,
                          tender.currency,
                        )}
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
                      <dd className="inline">
                        {formatTenderStatus(tender.status)}
                      </dd>
                    </div>
                  </dl>
                </div>
                {note ? (
                  <p
                    className={
                      noteWide
                        ? "w-full min-w-0 rounded-md border border-dashed border-border px-2.5 py-1.5 text-sm text-muted-foreground sm:ml-auto sm:min-w-[14rem] sm:max-w-[min(100%,36rem)] sm:flex-1"
                        : "w-full shrink-0 rounded-md border border-dashed border-border px-2.5 py-1.5 text-sm text-muted-foreground sm:ml-auto sm:w-[min(100%,16rem)]"
                    }
                  >
                    <span className="font-medium text-foreground">Nota:</span>{" "}
                    {note}
                  </p>
                ) : null}
              </div>
            </div>
            {showRemove && currentUserId ? (
              <RemoveSharedFavoriteButton
                tenderId={item.tender_id}
                userId={currentUserId}
                addedBy={item.added_by}
                addedByDisplayName={item.added_by_display_name}
              />
            ) : null}
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
  municipalityNames = {},
}: {
  searches: SavedSearchRow[];
  userId: string;
  digestFrequency: DigestFrequency;
  /** Origen al abrir en búsqueda (para el «volver»). */
  searchFrom?: "favorites" | "favorites-searches";
  /** Línea superior (false dentro de un recuadro con borde propio). */
  bordered?: boolean;
  municipalityNames?: Readonly<Record<string, string>>;
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
              {formatCriteriaSummary(criteria, { municipalityNames })}
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
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <div className={showMore ? "relative min-h-0 flex-1" : "min-h-0 flex-1"}>
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
