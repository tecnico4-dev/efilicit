"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const navItems = [
  { href: "/", label: "Inicio", match: (path: string) => path === "/" },
  {
    href: "/search",
    label: "Búsqueda",
    match: (path: string) => path.startsWith("/search"),
  },
  {
    href: "/alerts",
    label: "Alertas",
    match: (path: string) => path.startsWith("/alerts"),
  },
  {
    href: "/account",
    label: "Cuenta",
    match: (path: string) => path.startsWith("/account"),
  },
] as const;

export function AppHeader() {
  const pathname = usePathname() || "/";

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-surface/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-foreground"
        >
          Efi<span className="text-primary-dark">Licit</span>
        </Link>

        <nav aria-label="Principal" className="flex flex-1 flex-wrap items-center gap-1.5">
          {navItems.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground hover:bg-muted",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5">
          <Link
            href="/login"
            className={cn(
              "inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              pathname.startsWith("/login")
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            Login
          </Link>
          <Link
            href="/register"
            className={cn(
              "inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              pathname.startsWith("/register")
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            Registro
          </Link>
        </div>
      </div>
    </header>
  );
}
