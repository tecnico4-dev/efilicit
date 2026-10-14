"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { ChangePasswordModal } from "@/app/account/change-password-form";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.5 19.5c1.5-3.2 3.8-4.75 6.5-4.75s5 1.55 6.5 4.75" />
    </svg>
  );
}

/**
 * Control de cuenta a la derecha: círculo azul que se alarga al hover
 * (icono + nombre). Clic → /account. Menú: Tema, Cambiar contraseña, Cerrar sesión.
 */
export function AccountMenu({ displayName }: { displayName: string }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const label = displayName.trim() || "Usuario";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  function openMenu() {
    if (passwordOpen) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }

  function scheduleClose() {
    if (passwordOpen) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      setThemeOpen(false);
    }, 180);
  }

  async function onLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.replace("/");
    router.refresh();
  }

  const onAccount = pathname.startsWith("/account");
  const activeTheme = theme ?? "dark";

  return (
    <>
      <div
        className="relative"
        ref={rootRef}
        onMouseEnter={openMenu}
        onMouseLeave={scheduleClose}
      >
        <Link
          href="/account"
          aria-label={`Cuenta de ${label}`}
          aria-expanded={open}
          title={label}
          className={cn(
            "group inline-flex h-9 max-w-9 items-center overflow-hidden rounded-full bg-primary text-primary-foreground shadow-sm transition-[max-width] duration-200 ease-out hover:max-w-[14rem] hover:bg-primary-dark focus-visible:max-w-[14rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            open && "max-w-[14rem] bg-primary-dark",
            onAccount && "ring-2 ring-ring ring-offset-2 ring-offset-background",
          )}
        >
          <span className="inline-flex size-9 shrink-0 items-center justify-center">
            <UserIcon className="size-4" />
          </span>
          <span className="truncate whitespace-nowrap pr-3 text-sm font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 [[aria-expanded=true]_&]:opacity-100">
            {label}
          </span>
        </Link>

        {open && !passwordOpen ? (
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 min-w-[12rem] overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg"
            onMouseEnter={openMenu}
            onMouseLeave={scheduleClose}
          >
            <div>
              <button
                type="button"
                role="menuitem"
                aria-expanded={themeOpen}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                onClick={() => setThemeOpen((v) => !v)}
              >
                <span>Tema</span>
                <span aria-hidden className="text-xs text-muted-foreground">
                  {themeOpen ? "▴" : "▾"}
                </span>
              </button>
              {themeOpen ? (
                <div className="bg-muted/30 px-2 pb-2">
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={mounted && activeTheme === "light"}
                    disabled={!mounted}
                    className={cn(
                      "mt-0.5 block w-full rounded-md px-2 py-1.5 text-left text-sm",
                      mounted && activeTheme === "light"
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-muted",
                    )}
                    onClick={() => setTheme("light")}
                  >
                    Claro
                  </button>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={mounted && activeTheme === "dark"}
                    disabled={!mounted}
                    className={cn(
                      "mt-0.5 block w-full rounded-md px-2 py-1.5 text-left text-sm",
                      mounted && activeTheme === "dark"
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-muted",
                    )}
                    onClick={() => setTheme("dark")}
                  >
                    Oscuro
                  </button>
                </div>
              ) : null}
            </div>

            <div className="border-t border-border">
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                onClick={() => {
                  setOpen(false);
                  setPasswordOpen(true);
                }}
              >
                Cambiar contraseña
              </button>
            </div>

            <div className="border-t border-border">
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-sm font-medium text-destructive hover:bg-muted"
                onClick={onLogout}
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <ChangePasswordModal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
      />
    </>
  );
}
