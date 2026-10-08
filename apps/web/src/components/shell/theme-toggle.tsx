"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/cn";

/**
 * Selector claro / oscuro. Default de app = dark (ver layout).
 * Montaje diferido para evitar mismatch SSR/hidratación (next-themes).
 */
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const active = theme ?? "dark";
  const effective = resolvedTheme ?? "dark";

  return (
    <div
      className="inline-flex h-9 items-center gap-0.5 rounded-full border border-border/80 bg-background p-0.5"
      role="group"
      aria-label="Tema de color"
    >
      <button
        type="button"
        disabled={!mounted}
        onClick={() => setTheme("light")}
        className={cn(
          "rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50",
          mounted && active === "light"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        aria-pressed={mounted && active === "light"}
        title="Tema claro"
      >
        Claro
      </button>
      <button
        type="button"
        disabled={!mounted}
        onClick={() => setTheme("dark")}
        className={cn(
          "rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50",
          mounted && active === "dark"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        aria-pressed={mounted && active === "dark"}
        title="Tema oscuro"
      >
        Oscuro
      </button>
      <span className="sr-only">
        Tema efectivo: {mounted ? effective : "…"}
      </span>
    </div>
  );
}
