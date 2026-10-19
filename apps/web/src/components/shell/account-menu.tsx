"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { ChangePasswordModal } from "@/app/account/change-password-form";
import { useUndoToast } from "@/components/undo-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  updateOwnDigestFrequency,
  type DigestFrequency,
} from "@/lib/queries";
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

function freqLabel(f: DigestFrequency): string {
  return f === "semanal" ? "semanal" : "diaria";
}

/**
 * Círculo azul a la derecha: hover → nombre; clic → menú
 * (Tema, Frecuencia, Cambiar contraseña, Cerrar sesión).
 */
export function AccountMenu({
  displayName,
  userId,
  digestFrequency: initialFrequency,
}: {
  displayName: string;
  userId: string;
  digestFrequency: DigestFrequency;
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { showStatus } = useUndoToast();
  const [open, setOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [freqOpen, setFreqOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [frequency, setFrequency] = useState<DigestFrequency>(initialFrequency);
  const [freqPending, setFreqPending] = useState(false);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const label = displayName.trim() || "Usuario";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setFrequency(initialFrequency);
  }, [initialFrequency]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setThemeOpen(false);
        setFreqOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setThemeOpen(false);
        setFreqOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function onLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.replace("/login");
    router.refresh();
  }

  async function onSelectFrequency(next: DigestFrequency) {
    if (next === frequency || freqPending) return;
    const previous = frequency;
    setFrequency(next);
    setFreqPending(true);
    const client = createSupabaseBrowserClient();
    const { error } = await updateOwnDigestFrequency(client, {
      userId,
      digestFrequency: next,
    });
    setFreqPending(false);
    if (error) {
      setFrequency(previous);
      showStatus("No se pudo actualizar la frecuencia. Inténtalo de nuevo.");
      return;
    }
    showStatus(
      `Frecuencia de notificaciones cambiada a ${freqLabel(next)}.`,
    );
    router.refresh();
  }

  const activeTheme = theme ?? "dark";

  return (
    <>
      <div className="relative" ref={rootRef}>
        <button
          type="button"
          aria-label={`Menú de ${label}`}
          aria-expanded={open}
          aria-haspopup="menu"
          title={label}
          onClick={() => {
            setOpen((v) => !v);
            if (open) {
              setThemeOpen(false);
              setFreqOpen(false);
            }
          }}
          className={cn(
            "group inline-flex h-9 max-w-9 items-center overflow-hidden rounded-full bg-primary text-primary-foreground shadow-sm transition-[max-width] duration-500 ease-out hover:max-w-[14rem] hover:bg-primary-dark focus-visible:max-w-[14rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            open && "max-w-[14rem] bg-primary-dark",
          )}
        >
          <span className="inline-flex size-9 shrink-0 items-center justify-center">
            <UserIcon className="size-4" />
          </span>
          <span className="truncate whitespace-nowrap pr-3 text-sm font-medium opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 [[aria-expanded=true]_&]:opacity-100">
            {label}
          </span>
        </button>

        {open && !passwordOpen ? (
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 min-w-[13.5rem] overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg"
          >
            <div>
              <button
                type="button"
                role="menuitem"
                aria-expanded={themeOpen}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                onClick={() => {
                  setThemeOpen((v) => !v);
                  setFreqOpen(false);
                }}
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
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
                aria-expanded={freqOpen}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                onClick={() => {
                  setFreqOpen((v) => !v);
                  setThemeOpen(false);
                }}
              >
                <span>Frecuencia de la cuenta</span>
                <span aria-hidden className="text-xs text-muted-foreground">
                  {freqOpen ? "▴" : "▾"}
                </span>
              </button>
              {freqOpen ? (
                <div className="bg-muted/30 px-2 pb-2">
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={frequency === "diaria"}
                    disabled={freqPending}
                    className={cn(
                      "mt-0.5 block w-full rounded-md px-2 py-1.5 text-left text-sm",
                      frequency === "diaria"
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                    onClick={() => onSelectFrequency("diaria")}
                  >
                    Diaria
                  </button>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={frequency === "semanal"}
                    disabled={freqPending}
                    className={cn(
                      "mt-0.5 block w-full rounded-md px-2 py-1.5 text-left text-sm",
                      frequency === "semanal"
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                    onClick={() => onSelectFrequency("semanal")}
                  >
                    Semanal
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
