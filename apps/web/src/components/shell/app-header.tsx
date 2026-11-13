"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DigestFrequency } from "@/lib/queries";
import { isMisLicitacionesEnabled } from "@/lib/features/mis-licitaciones";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";
import { FavoritesSubnav } from "@/app/favorites/favorites-subnav";
import { AccountMenu } from "./account-menu";
import { FavoritesNavItem } from "./favorites-nav-item";

function navClass(active: boolean) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    active
      ? "bg-primary text-primary-foreground shadow-sm"
      : "text-foreground hover:bg-muted",
  );
}

const NAV_ICON_CLASS = "size-4 shrink-0";

/** Lupa del inicio (métrica Búsquedas). */
function NavSearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={NAV_ICON_CLASS}
      aria-hidden
    >
      <circle cx="10.5" cy="10.5" r="6.25" />
      <path d="M7.4 8.1c.7-1.5 2.1-2.5 3.7-2.7" />
      <path d="m15.2 15.2 5.3 5.3" />
    </svg>
  );
}

/** Triángulo de alerta del inicio. */
function NavAlertIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={NAV_ICON_CLASS}
      aria-hidden
    >
      <path d="M12 3.6 2.8 19.2a1.2 1.2 0 0 0 1.05 1.8h16.3a1.2 1.2 0 0 0 1.05-1.8L12 3.6z" />
      <path d="M12 9.2v5" />
      <path d="M12 17.2h.01" />
    </svg>
  );
}

/** Cabecera solo para sesión autenticada (ADR 016: anónimo sin nav). */
export function AppHeader({
  isAuthenticated,
  displayName,
  userId,
  digestFrequency,
  notifications,
}: {
  isAuthenticated: boolean;
  displayName: string;
  userId: string;
  digestFrequency: DigestFrequency;
  /** Slot RSC (p. ej. Suspense + badge); no bloquear el layout con la query. */
  notifications: ReactNode;
}) {
  const pathname = usePathname() || "/";

  if (!isAuthenticated) return null;

  const inFavorites = pathname.startsWith("/favorites");

  return (
    <header className="z-40 border-b border-border/80">
      {/* Solo la franja principal queda fija; el subnav de Favoritos se oculta al hacer scroll. */}
      <div className="sticky top-0 z-40 border-b border-border/80 bg-surface/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-surface/85">
        <div className="flex w-full flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-foreground"
          >
            Efi<span className="text-primary-dark">Licit</span>
          </Link>

          <nav
            aria-label="Principal"
            className="-mx-1 flex max-w-full flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto px-1 sm:flex-wrap sm:overflow-visible"
          >
            <Link
              href="/search"
              className={navClass(pathname.startsWith("/search"))}
            >
              <NavSearchIcon />
              Búsqueda
            </Link>
            <FavoritesNavItem active={inFavorites} />
            <Link
              href="/alerts"
              className={navClass(pathname.startsWith("/alerts"))}
            >
              <NavAlertIcon />
              Alertas
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            {isMisLicitacionesEnabled() ? (
              <Link
                href="/mis-licitaciones"
                className={navClass(pathname.startsWith("/mis-licitaciones"))}
              >
                Mis licitaciones
              </Link>
            ) : null}
            {notifications}
            {userId ? (
              <AccountMenu
                displayName={displayName}
                userId={userId}
                digestFrequency={digestFrequency}
              />
            ) : null}
          </div>
        </div>
      </div>

      {inFavorites ? (
        <div className="border-b border-primary/25 bg-primary-light/45 dark:bg-primary/15">
          <div className="flex w-full px-4 py-2 sm:px-6 lg:px-8">
            <FavoritesSubnav />
          </div>
        </div>
      ) : null}
    </header>
  );
}
