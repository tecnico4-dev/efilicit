"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DigestFrequency } from "@/lib/queries";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";
import { AccountMenu } from "./account-menu";
import { FavoritesNavItem } from "./favorites-nav-item";

function navClass(active: boolean) {
  return cn(
    "inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    active
      ? "bg-primary text-primary-foreground shadow-sm"
      : "text-foreground hover:bg-muted",
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

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-surface/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
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
            Búsqueda
          </Link>
          <FavoritesNavItem active={pathname.startsWith("/favorites")} />
          <Link
            href="/alerts"
            className={navClass(pathname.startsWith("/alerts"))}
          >
            Alertas
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/my-tenders"
            className={navClass(pathname.startsWith("/my-tenders"))}
          >
            Mis licitaciones
          </Link>
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
    </header>
  );
}
