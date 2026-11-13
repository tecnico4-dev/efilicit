"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import {
  favoritesSectionHref,
  readFavoritesLastSection,
} from "@/app/favorites/favorites-last-section";

/**
 * Favoritos en nav principal: vuelve a la última sección visitada
 * (por defecto Licitaciones favoritas).
 */
export function FavoritesNavItem({ active }: { active: boolean }) {
  const pathname = usePathname() || "/";
  const [href, setHref] = useState("/favorites/tenders");

  useEffect(() => {
    setHref(favoritesSectionHref(readFavoritesLastSection()));
  }, [active, pathname]);

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-foreground hover:bg-muted",
      )}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(
          "size-4 shrink-0",
          active ? "text-primary-foreground" : "text-muted-foreground",
        )}
        aria-hidden
      >
        <path d="M19.5 12.572 12 20l-7.5-7.428A5 5 0 1 1 12 5.072a5 5 0 1 1 7.5 7.5Z" />
      </svg>
      Favoritos
    </Link>
  );
}
