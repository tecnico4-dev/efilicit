import Link from "next/link";
import { PAGE_MAIN_CLASS } from "@/components/shell/page-width";
import { formatTenderStatus } from "@/lib/tender-labels";
import type {
  DigestFrequency,
  FavoriteStatusNotification,
  FavoriteWithTender,
} from "@/lib/queries";
import type { Database } from "@efilicit/types";

type AlertRow = Database["public"]["Tables"]["alerts"]["Row"];
type SavedSearchRow = Database["public"]["Tables"]["saved_searches"]["Row"];

function deadlineLabel(iso: string | null): string {
  if (!iso) return "Sin plazo";
  try {
    const deadline = new Date(iso);
    if (Number.isNaN(deadline.getTime())) return "Sin plazo";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = new Date(deadline);
    day.setHours(0, 0, 0, 0);
    const diff = Math.round(
      (day.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diff < 0) return `Venció hace ${Math.abs(diff)} d`;
    if (diff === 0) return "Hoy";
    if (diff === 1) return "Mañana";
    return `${diff} días`;
  } catch {
    return "Sin plazo";
  }
}

function deadlineUrgencyClass(iso: string | null): string {
  if (!iso) return "text-muted-foreground";
  try {
    const deadline = new Date(iso);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = new Date(deadline);
    day.setHours(0, 0, 0, 0);
    const diff = Math.round(
      (day.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diff < 0) return "text-destructive";
    if (diff <= 7) return "text-primary-dark";
    return "text-muted-foreground";
  } catch {
    return "text-muted-foreground";
  }
}

/** Favoritos con plazo más cercano primero; sin plazo al final. Máx. 5. */
function attentionFavorites(favorites: FavoriteWithTender[]): FavoriteWithTender[] {
  return [...favorites]
    .filter((f) => f.tenders)
    .sort((a, b) => {
      const da = a.tenders?.deadline_at;
      const db = b.tenders?.deadline_at;
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da < db ? -1 : da > db ? 1 : 0;
    })
    .slice(0, 5);
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-ES", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function HomeDashboard({
  displayName,
  alerts,
  favorites,
  searches,
  digestFrequency,
  unreadCount,
  recentNotifications,
}: {
  displayName: string;
  alerts: AlertRow[];
  favorites: FavoriteWithTender[];
  searches: SavedSearchRow[];
  digestFrequency: DigestFrequency;
  unreadCount: number;
  recentNotifications: FavoriteStatusNotification[];
}) {
  const activeAlerts = alerts.filter((a) => a.is_active);
  const digestLabel = digestFrequency === "semanal" ? "semanal" : "diaria";
  const greeting = displayName ? `Hola, ${displayName}` : "Hola";
  const isEmptyHome =
    activeAlerts.length === 0 &&
    favorites.length === 0 &&
    searches.length === 0;
  const attention = attentionFavorites(favorites);

  const metrics = [
    {
      label: "Alertas activas",
      value: activeAlerts.length,
      href: "/alerts",
      delay: "home-anim-delay-2",
    },
    {
      label: "Favoritos",
      value: favorites.length,
      href: "/favorites/tenders?from=home",
      delay: "home-anim-delay-3",
    },
    {
      label: "Sin leer",
      value: unreadCount,
      href: "/notifications",
      delay: "home-anim-delay-4",
      emphasize: unreadCount > 0,
    },
    {
      label: "Búsquedas",
      value: searches.length,
      href: "/favorites/searches?from=home",
      delay: "home-anim-delay-5",
    },
  ] as const;

  return (
    <main className={`${PAGE_MAIN_CLASS} home-dashboard`}>
      <p className="home-anim text-center text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
        Efi<span className="text-primary-dark">Licit</span>
      </p>

      <header className="home-anim home-anim-delay-1 mt-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {greeting}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Correos: frecuencia {digestLabel}.
        </p>
      </header>

      <section
        aria-label="Resumen"
        className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {metrics.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className={[
              "home-anim home-metric group rounded-xl border border-border/80 bg-surface/70 px-4 py-4",
              "transition-[transform,box-shadow,border-color] duration-200",
              "hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              m.delay,
              "emphasize" in m && m.emphasize
                ? "border-primary/40 bg-primary-light/30 dark:bg-primary-light/20"
                : "",
            ].join(" ")}
          >
            <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">
              {m.value}
            </p>
            <p className="mt-1 text-xs font-medium text-muted-foreground group-hover:text-foreground sm:text-sm">
              {m.label}
            </p>
          </Link>
        ))}
      </section>

      {isEmptyHome ? (
        <section className="home-anim home-anim-delay-6 mt-10 rounded-2xl border border-dashed border-border bg-surface/40 px-6 py-10 text-center">
          <h2 className="text-lg font-semibold text-foreground">
            Empieza tu seguimiento
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Busca licitaciones, guárdalas en favoritos o crea una alerta para
            recibir novedades.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/search"
              className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-dark"
            >
              Buscar licitaciones
            </Link>
            <Link
              href="/alerts"
              className="inline-flex rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Crear una alerta
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section className="home-anim home-anim-delay-6 mt-10">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Atención
              </h2>
              {favorites.length > 0 ? (
                <Link
                  href="/favorites/tenders?from=home"
                  className="text-sm font-medium text-link hover:underline"
                >
                  Ver favoritos
                </Link>
              ) : null}
            </div>
            {attention.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Aún no tienes favoritos.{" "}
                <Link href="/search" className="font-medium text-link hover:underline">
                  Buscar
                </Link>
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-border border-y border-border">
                {attention.map((fav) => {
                  const tender = fav.tenders!;
                  return (
                    <li key={fav.id}>
                      <Link
                        href={`/tenders/${tender.id}?from=home`}
                        className="flex flex-col gap-1 py-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {tender.title}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {formatTenderStatus(tender.status)}
                          </span>
                        </span>
                        <span
                          className={[
                            "shrink-0 text-xs font-medium sm:text-sm",
                            deadlineUrgencyClass(tender.deadline_at),
                          ].join(" ")}
                        >
                          {deadlineLabel(tender.deadline_at)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="home-anim home-anim-delay-7 mt-10">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Últimos cambios
              </h2>
              <Link
                href="/notifications"
                className="text-sm font-medium text-link hover:underline"
              >
                Ver todas
              </Link>
            </div>
            {recentNotifications.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Sin cambios recientes.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-border border-y border-border">
                {recentNotifications.map((n) => (
                  <li key={n.eventId}>
                    <Link
                      href={`/tenders/${n.tenderId}`}
                      className="block py-3 transition-colors hover:bg-muted/40"
                    >
                      <p className="truncate text-sm font-medium text-foreground">
                        {n.title}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {formatTenderStatus(n.previousStatus)}
                        {" → "}
                        <span className="font-medium text-foreground">
                          {formatTenderStatus(n.newStatus)}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatWhen(n.occurredAt)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
