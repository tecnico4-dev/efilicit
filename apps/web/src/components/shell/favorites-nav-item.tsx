"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

const OPEN_DELAY_MS = 350;
const CLOSE_DELAY_MS = 60;

function canHoverFine(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/**
 * Favoritos en nav: hover (con retardo) abre un globo con atajos
 * a licitaciones / búsquedas (`?from=nav` → «Ir a…» en el listado).
 * En táctil/sin hover fino: primer toque abre el menú; segundo va a /favorites.
 */
export function FavoritesNavItem({ active }: { active: boolean }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimers() {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }

  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function onEnter() {
    if (!canHoverFine()) return;
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    if (open) return;
    openTimer.current = setTimeout(() => setOpen(true), OPEN_DELAY_MS);
  }

  function onLeave() {
    if (!canHoverFine()) return;
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }

  function onPrimaryClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (canHoverFine()) return;
    if (!open) {
      e.preventDefault();
      setOpen(true);
    }
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          onLeave();
        }
      }}
    >
      <Link
        href="/favorites"
        className={cn(
          "inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-foreground hover:bg-muted",
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={onPrimaryClick}
      >
        Favoritos
      </Link>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1 min-w-[11rem] rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          <Link
            role="menuitem"
            href="/favorites/tenders?from=nav"
            className="block px-3 py-2 text-sm text-foreground hover:bg-muted"
            onClick={() => setOpen(false)}
          >
            Licitaciones
          </Link>
          <Link
            role="menuitem"
            href="/favorites/searches?from=nav"
            className="block px-3 py-2 text-sm text-foreground hover:bg-muted"
            onClick={() => setOpen(false)}
          >
            Búsquedas
          </Link>
        </div>
      ) : null}
    </div>
  );
}
