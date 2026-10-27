"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/cn";

function SunIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden
    >
      <path d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5z" />
    </svg>
  );
}

/**
 * Toggle claro/oscuro compacto (icono). Default de app = dark.
 * Montaje diferido para evitar mismatch SSR/hidratación (next-themes).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Hasta `mounted`, no leer el tema (localStorage ≠ SSR → hydration mismatch).
  const isDark = mounted && (resolvedTheme ?? "dark") === "dark";
  const next = isDark ? "light" : "dark";

  return (
    <button
      type="button"
      disabled={!mounted}
      onClick={() => setTheme(next)}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-full border border-border/60 bg-surface/50 text-foreground shadow-sm backdrop-blur-sm transition-colors",
        "hover:bg-surface/80 hover:text-foreground disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className,
      )}
      aria-label={
        mounted
          ? isDark
            ? "Cambiar a tema claro"
            : "Cambiar a tema oscuro"
          : "Cambiar tema"
      }
      title={mounted ? (isDark ? "Tema claro" : "Tema oscuro") : "Tema"}
    >
      {mounted ? (isDark ? <SunIcon /> : <MoonIcon />) : (
        <span className="size-4" aria-hidden />
      )}
    </button>
  );
}
