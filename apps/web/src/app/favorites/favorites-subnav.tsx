"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  favoritesSectionFromPath,
  writeFavoritesLastSection,
  type FavoritesSection,
} from "./favorites-last-section";

type Counts = Record<FavoritesSection, number | null>;

const ITEMS: {
  section: FavoritesSection;
  href: string;
  label: string;
  icon: ReactNode;
}[] = [
  {
    section: "tenders",
    href: "/favorites/tenders",
    label: "Licitaciones favoritas",
    icon: <TendersIcon />,
  },
  {
    section: "common",
    href: "/favorites/common",
    label: "Carpeta común",
    icon: <CommonIcon />,
  },
  {
    section: "searches",
    href: "/favorites/searches",
    label: "Búsquedas guardadas",
    icon: <SearchesIcon />,
  },
];

function iconClass(active: boolean) {
  return cn(
    "size-4 shrink-0",
    active ? "text-primary-dark" : "text-muted-foreground",
  );
}

function TendersIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden
    >
      <path d="M6 3.5h8.2L18.5 7.8V20a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4.5 20V5A1.5 1.5 0 0 1 6 3.5z" />
      <path d="M14.2 3.5V7.8h4.3" />
      <path d="M8 12h8" />
      <path d="M8 16h5.5" />
    </svg>
  );
}

function CommonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden
    >
      <path d="M6 3.5h8.2L18.5 7.8V20a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4.5 20V5A1.5 1.5 0 0 1 6 3.5z" />
      <path d="M14.2 3.5V7.8h4.3" />
      <circle cx="17.8" cy="17.8" r="4.2" fill="var(--surface)" />
      <circle cx="17.8" cy="17.8" r="4.2" />
      <circle cx="16.1" cy="17.8" r="0.85" fill="currentColor" stroke="none" />
      <circle cx="19.1" cy="16.1" r="0.85" fill="currentColor" stroke="none" />
      <circle cx="19.1" cy="19.5" r="0.85" fill="currentColor" stroke="none" />
      <path d="M16.75 17.35 18.35 16.4" />
      <path d="M16.75 18.25 18.35 19.2" />
    </svg>
  );
}

function SearchesIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden
    >
      <circle cx="10.5" cy="10.5" r="6.25" />
      <path d="M7.4 8.1c.7-1.5 2.1-2.5 3.7-2.7" />
      <path d="m15.2 15.2 5.3 5.3" />
    </svg>
  );
}

/** Segunda franja de navegación dentro de Favoritos. */
export function FavoritesSubnav() {
  const pathname = usePathname() || "/";
  const [counts, setCounts] = useState<Counts>({
    tenders: null,
    common: null,
    searches: null,
  });

  useEffect(() => {
    const section = favoritesSectionFromPath(pathname);
    if (section) writeFavoritesLastSection(section);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    const client = createSupabaseBrowserClient();

    void Promise.all([
      client.from("favorites").select("id", { count: "exact", head: true }),
      client
        .from("shared_favorites")
        .select("tender_id", { count: "exact", head: true }),
      client
        .from("saved_searches")
        .select("id", { count: "exact", head: true }),
    ]).then(([tenders, common, searches]) => {
      if (cancelled) return;
      setCounts({
        tenders: tenders.count ?? 0,
        common: common.count ?? 0,
        searches: searches.count ?? 0,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <nav
      aria-label="Secciones de favoritos"
      className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1"
    >
      {ITEMS.map((item) => {
        const active = favoritesSectionFromPath(pathname) === item.section;
        const count = counts[item.section];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-background/80 text-primary-dark shadow-sm"
                : "text-foreground/80 hover:bg-background/50 hover:text-foreground",
            )}
          >
            <span className={iconClass(active)}>{item.icon}</span>
            {item.label}
            <span
              className={cn(
                "min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums",
                active
                  ? "bg-primary/20 text-primary-dark"
                  : "bg-background/60 text-muted-foreground",
              )}
            >
              {count == null ? "…" : count}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
