import type { ReactNode } from "react";
import Link from "next/link";
import { PAGE_MAIN_MEDIUM_CLASS } from "@/components/shell/page-width";
import { ErrorState } from "@/components/ui/state-message";
import { calendarDayMadrid, formatDateTimeMadrid } from "@/lib/datetime";
import { formatTenderStatus } from "@/lib/tender-labels";
import type {
  DigestFrequency,
  FavoriteStatusNotification,
  FavoriteWithTender,
  SharedFavoriteWithTender,
} from "@/lib/queries";
import type { Database } from "@efilicit/types";

type AlertRow = Database["public"]["Tables"]["alerts"]["Row"];
type SavedSearchRow = Database["public"]["Tables"]["saved_searches"]["Row"];

const METRIC_ICON_CLASS =
  "size-9 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground sm:size-10";

function MetricIconShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? METRIC_ICON_CLASS}
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Documento con pliegue (base para favoritas / comunes). */
function TenderDocumentPaths() {
  return (
    <>
      <path d="M6 3.5h8.2L18.5 7.8V20a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4.5 20V5A1.5 1.5 0 0 1 6 3.5z" />
      <path d="M14.2 3.5V7.8h4.3" />
      <path d="M8 12h8" />
      <path d="M8 16h5.5" />
    </>
  );
}

/** Alerta: triángulo con exclamación (estilo outline del shell). */
function AlertMetricIcon() {
  return (
    <MetricIconShell>
      <path d="M12 3.6 2.8 19.2a1.2 1.2 0 0 0 1.05 1.8h16.3a1.2 1.2 0 0 0 1.05-1.8L12 3.6z" />
      <path d="M12 9.2v5" />
      <path d="M12 17.2h.01" />
    </MetricIconShell>
  );
}

/** Licitaciones favoritas: documento con pliegue. */
function TendersMetricIcon() {
  return (
    <MetricIconShell>
      <TenderDocumentPaths />
    </MetricIconShell>
  );
}

/** Común: mismo documento que favoritas + badge compartir (recorte, sin pisarse). */
function SharedTendersMetricIcon() {
  return (
    <MetricIconShell>
      <defs>
        <mask id="home-metric-shared-cut">
          <rect width="24" height="24" fill="white" />
          <circle cx="17.8" cy="17.8" r="6.35" fill="black" />
        </mask>
      </defs>
      <g mask="url(#home-metric-shared-cut)">
        <TenderDocumentPaths />
      </g>
      <circle cx="17.8" cy="17.8" r="5" />
      <circle cx="15.55" cy="17.8" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="19.55" cy="15.45" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="19.55" cy="20.15" r="1.05" fill="currentColor" stroke="none" />
      <path d="M16.4 17.15 18.55 15.9" />
      <path d="M16.4 18.45 18.55 19.7" />
    </MetricIconShell>
  );
}

/** Notificaciones: mismo buzón que el header (coherencia de shell). */
function NotificationsMetricIcon() {
  return (
    <MetricIconShell>
      <rect x="2.5" y="5" width="19" height="14" rx="1.5" />
      <path d="m2.5 7.5 8.7 5.6a1.4 1.4 0 0 0 1.6 0l8.7-5.6" />
      <path d="m2.5 17.5 6.2-5" />
      <path d="m21.5 17.5-6.2-5" />
    </MetricIconShell>
  );
}

/** Búsquedas: lupa outline con brillo en el cristal. */
function SearchesMetricIcon() {
  return (
    <MetricIconShell>
      <circle cx="10.5" cy="10.5" r="6.25" />
      <path d="M7.4 8.1c.7-1.5 2.1-2.5 3.7-2.7" />
      <path d="m15.2 15.2 5.3 5.3" />
    </MetricIconShell>
  );
}

function daysUntilDeadlineMadrid(iso: string | null): number | null {
  if (!iso) return null;
  const deadlineDay = calendarDayMadrid(iso);
  const todayDay = calendarDayMadrid(new Date());
  if (!deadlineDay || !todayDay) return null;
  const deadline = new Date(`${deadlineDay}T12:00:00Z`);
  const today = new Date(`${todayDay}T12:00:00Z`);
  return Math.round(
    (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}

function deadlineLabel(iso: string | null): string {
  const diff = daysUntilDeadlineMadrid(iso);
  if (diff == null) return "Sin plazo";
  if (diff < 0) return `Venció hace ${Math.abs(diff)} d`;
  if (diff === 0) return "Vence hoy";
  if (diff === 1) return "Vence mañana";
  return `Vence en ${diff} días`;
}

function deadlineUrgencyClass(iso: string | null): string {
  const diff = daysUntilDeadlineMadrid(iso);
  if (diff == null) return "text-muted-foreground";
  if (diff < 0) return "text-destructive";
  if (diff <= 7) return "text-primary-dark";
  return "text-muted-foreground";
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
    return formatDateTimeMadrid(iso);
  } catch {
    return iso;
  }
}

export function HomeDashboard({
  displayName,
  alerts,
  favorites,
  sharedFavorites,
  searches,
  digestFrequency,
  unreadCount,
  recentNotifications,
  loadError = null,
}: {
  displayName: string;
  alerts: AlertRow[];
  favorites: FavoriteWithTender[];
  sharedFavorites: SharedFavoriteWithTender[];
  searches: SavedSearchRow[];
  digestFrequency: DigestFrequency;
  unreadCount: number;
  recentNotifications: FavoriteStatusNotification[];
  loadError?: string | null;
}) {
  const activeAlerts = alerts.filter((a) => a.is_active);
  const digestLabel = digestFrequency === "semanal" ? "semanal" : "diaria";
  const greeting = displayName ? `Hola, ${displayName}` : "Hola";
  const isEmptyHome =
    activeAlerts.length === 0 &&
    favorites.length === 0 &&
    sharedFavorites.length === 0 &&
    searches.length === 0;
  const attention = attentionFavorites(favorites);

  const metrics = [
    {
      label:
        activeAlerts.length === 1 ? "Alerta activa" : "Alertas activas",
      value: activeAlerts.length,
      href: "/alerts",
      delay: "home-anim-delay-2",
      icon: <AlertMetricIcon />,
    },
    {
      label:
        favorites.length === 1
          ? "Licitación favorita"
          : "Licitaciones favoritas",
      value: favorites.length,
      href: "/favorites/tenders",
      delay: "home-anim-delay-3",
      icon: <TendersMetricIcon />,
    },
    {
      label:
        sharedFavorites.length === 1
          ? "Licitación común"
          : "Licitaciones comunes",
      value: sharedFavorites.length,
      href: "/favorites/common",
      delay: "home-anim-delay-4",
      icon: <SharedTendersMetricIcon />,
    },
    {
      label:
        unreadCount === 1
          ? "Notificación sin leer"
          : "Notificaciones sin leer",
      value: unreadCount,
      href: "/notifications",
      delay: "home-anim-delay-5",
      emphasize: unreadCount > 0,
      icon: <NotificationsMetricIcon />,
    },
    {
      label:
        searches.length === 1
          ? "Búsqueda guardada"
          : "Búsquedas guardadas",
      value: searches.length,
      href: "/favorites/searches",
      delay: "home-anim-delay-6",
      icon: <SearchesMetricIcon />,
    },
  ];

  return (
    <main className={`${PAGE_MAIN_MEDIUM_CLASS} home-dashboard`}>
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

      {loadError ? <ErrorState className="mt-6">{loadError}</ErrorState> : null}

      <section
        aria-label="Resumen"
        className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
      >
        {metrics.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className={[
              "home-anim home-metric group rounded-xl border border-border/80 bg-surface/70 px-4 py-6 sm:px-5 sm:py-7",
              "transition-[transform,box-shadow,border-color] duration-200",
              "hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              m.delay,
              "emphasize" in m && m.emphasize
                ? "border-primary/40 bg-primary-light/30 dark:bg-primary-light/20"
                : "",
            ].join(" ")}
          >
            <div className="flex items-center gap-3">
              <p className="text-4xl font-semibold tabular-nums tracking-tight text-foreground sm:text-5xl">
                {m.value}
              </p>
              {m.icon}
            </div>
            <p className="mt-1 text-xs font-medium text-muted-foreground group-hover:text-foreground sm:text-sm">
              {m.label}
            </p>
          </Link>
        ))}
      </section>

      {isEmptyHome ? (
        <section className="home-anim home-anim-delay-7 mt-10 rounded-2xl border border-dashed border-border bg-surface/40 px-6 py-10 text-center">
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
        <div className="mt-10 grid grid-cols-1 items-start gap-8 lg:grid-cols-2 lg:gap-6">
          <section className="home-anim home-anim-delay-7 min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Última oportunidad
              </h2>
              {favorites.length > 0 ? (
                <Link
                  href="/favorites/tenders"
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

          <section className="home-anim home-anim-delay-8 min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Cambios en tus favoritos
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
        </div>
      )}
    </main>
  );
}
