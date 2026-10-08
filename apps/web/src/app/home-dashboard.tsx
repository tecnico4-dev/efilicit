import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  formatCriteriaSummary,
  parseCriteria,
} from "@/lib/criteria-display";
import type { FavoriteWithTender } from "@/lib/queries";
import type { Database } from "@efilicit/types";
import {
  FavoriteTenderList,
  searchHrefFromCriteria,
} from "./favorites/favorites-shared";

const PREVIEW = 5;

type AlertRow = Database["public"]["Tables"]["alerts"]["Row"];
type SavedSearchRow = Database["public"]["Tables"]["saved_searches"]["Row"];

function Section({
  title,
  href,
  hrefLabel,
  emptyMessage,
  emptyHref,
  emptyCta,
  children,
  showMore,
}: {
  title: string;
  href: string;
  hrefLabel: string;
  emptyMessage: string;
  emptyHref: string;
  emptyCta: string;
  children: ReactNode | null;
  showMore: boolean;
}) {
  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <Link
          href={href}
          className="text-sm font-medium text-link hover:underline"
        >
          {hrefLabel}
        </Link>
      </div>
      {children == null ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {emptyMessage}{" "}
          <Link href={emptyHref} className="font-medium text-link hover:underline">
            {emptyCta}
          </Link>
        </p>
      ) : (
        <div className="mt-3">
          {children}
          {showMore ? (
            <p className="py-3 text-center">
              <Link
                href={href}
                className="text-sm font-medium text-primary hover:text-primary-dark hover:underline"
              >
                Ver todas
              </Link>
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

export function HomeDashboard({
  alerts,
  favorites,
  searches,
}: {
  alerts: AlertRow[];
  favorites: FavoriteWithTender[];
  searches: SavedSearchRow[];
}) {
  const activeAlerts = alerts.filter((a) => a.is_active);
  const alertPreview = activeAlerts.slice(0, PREVIEW);
  const favPreview = favorites.slice(0, PREVIEW);
  const searchPreview = searches.slice(0, PREVIEW);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Efi<span className="text-primary-dark">Licit</span>
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Resumen de tu seguimiento.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button href="/search">Buscar licitaciones</Button>
        <Button href="/alerts" variant="outline">
          Alertas
        </Button>
        <Button href="/favorites" variant="outline">
          Favoritos
        </Button>
      </div>

      <Section
        title="Alertas activas"
        href="/alerts"
        hrefLabel="Ir a Alertas"
        emptyMessage="No tienes alertas activas."
        emptyHref="/alerts"
        emptyCta="Crear una"
        showMore={activeAlerts.length > PREVIEW}
      >
        {alertPreview.length === 0 ? null : (
          <ul className="divide-y divide-border border-t border-border">
            {alertPreview.map((a) => (
              <li key={a.id} className="py-3">
                <p className="font-medium text-foreground">{a.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatCriteriaSummary(parseCriteria(a.criteria))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Licitaciones favoritas"
        href="/favorites"
        hrefLabel="Ir a Favoritos"
        emptyMessage="Aún no tienes favoritos."
        emptyHref="/search"
        emptyCta="Buscar"
        showMore={favorites.length > PREVIEW}
      >
        {favPreview.length === 0 ? null : (
          <FavoriteTenderList favorites={favPreview} from="favorites" />
        )}
      </Section>

      <Section
        title="Búsquedas guardadas"
        href="/favorites"
        hrefLabel="Ir a Favoritos"
        emptyMessage="Ninguna búsqueda guardada."
        emptyHref="/search"
        emptyCta="Buscar"
        showMore={searches.length > PREVIEW}
      >
        {searchPreview.length === 0 ? null : (
          <ul className="divide-y divide-border border-t border-border">
            {searchPreview.map((s) => {
              const criteria = parseCriteria(s.criteria);
              return (
                <li key={s.id} className="py-3 text-sm">
                  <p className="font-medium text-foreground">{s.name}</p>
                  <p className="mt-1 text-muted-foreground">
                    {formatCriteriaSummary(criteria)}
                  </p>
                  <Link
                    href={searchHrefFromCriteria(criteria)}
                    className="mt-2 inline-block font-medium text-link hover:underline"
                  >
                    Abrir en búsqueda
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </main>
  );
}

/** Landing para visitantes sin sesión. */
export function HomeLanding() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="relative flex max-w-lg flex-col items-center text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Vigilancia de contratación pública
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Efi<span className="text-primary-dark">Licit</span>
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          Busca licitaciones de forma sencilla. Inicia sesión para guardar
          alertas y personalizar tu seguimiento.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button href="/search">Buscar licitaciones</Button>
          <Button href="/login" variant="outline">
            Iniciar sesión
          </Button>
          <Button href="/register" variant="ghost">
            Registrarse
          </Button>
        </div>
      </div>
    </main>
  );
}
