"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const NAV_ICON_CLASS = "size-4 shrink-0";

function NavSparklesIcon() {
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
      <path d="M10.2 3.8 11.5 8l4.2 1.3-4.2 1.3-1.3 4.2-1.3-4.2L4.7 9.3 8.9 8z" />
      <path d="m17.2 13.2.7 2.2 2.2.7-2.2.7-.7 2.2-.7-2.2-2.2-.7 2.2-.7z" />
      <path d="M6.2 15.8v2.2M5.1 16.9h2.2" />
    </svg>
  );
}

function NavRadarIcon() {
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
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.6" />
      <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />
      <path d="M12 12 17.2 7.4" />
    </svg>
  );
}

function NavBulbIcon() {
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
      <path d="M9.2 17.6h5.6" />
      <path d="M10 20h4" />
      <path d="M8.4 14.2c-1.5-1.2-2.4-3-2.4-5 0-3.4 2.7-6.2 6-6.2s6 2.8 6 6.2c0 2-0.9 3.8-2.4 5l-.6.5v1.3H9l-.6-.5z" />
    </svg>
  );
}

/** Enlace «Recomendaciones» (activo según pathname). */
export function RecommendationsNavLink() {
  const pathname = usePathname() || "/";
  const active = pathname.startsWith("/recommendations");

  return (
    <Link
      href="/recommendations"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-foreground hover:bg-muted",
      )}
      title="Comparativa iconos: destellos · radar · bombilla"
    >
      <span className="inline-flex items-center gap-1" aria-hidden>
        <NavSparklesIcon />
        <NavRadarIcon />
        <NavBulbIcon />
      </span>
      Recomendaciones
    </Link>
  );
}
