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

/** Enlace «Recomendaciones» (activo según pathname). */
export function RecommendationsNavLink() {
  const pathname = usePathname() || "/";
  const active = pathname.startsWith("/recommendations");

  return (
    <Link
      href="/recommendations"
      aria-label="Recomendaciones"
      className={cn(
        "inline-flex items-center gap-0 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors sm:gap-1.5 sm:px-3",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-foreground hover:bg-muted",
      )}
    >
      <NavSparklesIcon />
      <span className="hidden sm:inline">Recomendaciones</span>
    </Link>
  );
}
