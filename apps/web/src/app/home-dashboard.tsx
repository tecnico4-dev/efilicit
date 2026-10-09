import Link from "next/link";
import { Button } from "@/components/ui/button";
import { searchHrefFromCriteria } from "./favorites/favorites-shared";
import { parseCriteria } from "@/lib/criteria-display";
import type { DigestFrequency, FavoriteWithTender } from "@/lib/queries";
import type { Database } from "@efilicit/types";
import { ExpandableSummarySection } from "./expandable-summary-section";

type AlertRow = Database["public"]["Tables"]["alerts"]["Row"];
type SavedSearchRow = Database["public"]["Tables"]["saved_searches"]["Row"];

export function HomeDashboard({
  alerts,
  favorites,
  searches,
  digestFrequency,
}: {
  alerts: AlertRow[];
  favorites: FavoriteWithTender[];
  searches: SavedSearchRow[];
  digestFrequency: DigestFrequency;
}) {
  const activeAlerts = alerts.filter((a) => a.is_active);
  const digestLabel = digestFrequency === "weekly" ? "semanal" : "diaria";

  const alertItems = activeAlerts.map((a) => (
    <p key={a.id} className="font-medium text-foreground">
      {a.name}
    </p>
  ));

  const favoriteItems = favorites.map((fav) => {
    const tender = fav.tenders;
    if (!tender) {
      return (
        <p key={fav.id} className="text-sm text-muted-foreground">
          Licitación no disponible
        </p>
      );
    }
    return (
      <Link
        key={fav.id}
        href={`/tenders/${tender.id}?from=home`}
        className="font-medium text-foreground hover:text-link hover:underline"
      >
        {tender.title}
      </Link>
    );
  });

  const searchItems = searches.map((s) => {
    const criteria = parseCriteria(s.criteria);
    return (
      <Link
        key={s.id}
        href={searchHrefFromCriteria(criteria)}
        className="font-medium text-foreground hover:text-link hover:underline"
      >
        {s.name}
      </Link>
    );
  });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
      <div className="flex flex-col items-center text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Efi<span className="text-primary-dark">Licit</span>
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          Resumen de tu seguimiento.
        </p>
        <p className="mt-1 text-base text-muted-foreground">
          Frecuencia de correos: {digestLabel}. Cambiar en{" "}
          <a href="/account" className="font-medium text-link hover:underline">
            Cuenta
          </a>
        </p>
      </div>

      <ExpandableSummarySection
        title="Alertas activas"
        href="/alerts"
        hrefLabel="Ir a Alertas"
        emptyMessage="No tienes alertas activas."
        emptyHref="/alerts"
        emptyCta="Crear una"
        items={alertItems}
      />

      <ExpandableSummarySection
        title="Licitaciones favoritas"
        href="/favorites/tenders?from=home"
        hrefLabel="Ver listado"
        emptyMessage="Aún no tienes favoritos."
        emptyHref="/search"
        emptyCta="Buscar"
        items={favoriteItems}
      />

      <ExpandableSummarySection
        title="Búsquedas guardadas"
        href="/favorites/searches?from=home"
        hrefLabel="Ver listado"
        emptyMessage="Ninguna búsqueda guardada."
        emptyHref="/search"
        emptyCta="Buscar"
        items={searchItems}
      />
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
