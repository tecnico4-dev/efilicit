"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

/**
 * Menú anclado al trigger vía portal fijo (escapa overflow de modales).
 * z-index por encima del modal de alertas (`z-[200]`).
 */
export function AnchoredPortal({
  open,
  anchorRef,
  onDismiss,
  children,
  className,
  /** Espacio bajo el ancla (px). */
  gap = 4,
  matchAnchorWidth = true,
  /** Alineación horizontal respecto al ancla. */
  align = "start",
  minWidth,
  maxWidth,
  maxHeight = 224,
  /**
   * `auto` = scroll; `hidden` = recorta (ambos ejes, sin barra);
   * `visible` = deja salir animaciones (p. ej. rebote).
   */
  overflowY = "auto",
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  /** Clic fuera de ancla + portal. */
  onDismiss?: () => void;
  children: ReactNode;
  className?: string;
  gap?: number;
  matchAnchorWidth?: boolean;
  align?: "start" | "center";
  minWidth?: number;
  maxWidth?: number;
  /** Altura máx. del panel (scroll interno). Omitir con `overflowY="visible"`. */
  maxHeight?: number | null;
  overflowY?: "auto" | "hidden" | "visible";
}) {
  const [mounted, setMounted] = useState(false);
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const [panelEl, setPanelEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const panelW = matchAnchorWidth
      ? r.width
      : Math.min(
          maxWidth ?? Number.POSITIVE_INFINITY,
          Math.max(minWidth ?? 0, r.width),
        );

    let left =
      align === "center" ? r.left + r.width / 2 - panelW / 2 : r.left;
    if (left + panelW > vw - 8) left = Math.max(8, vw - 8 - panelW);
    if (left < 8) left = 8;

    const spaceBelow = vh - r.bottom - gap - 8;
    const spaceAbove = r.top - gap - 8;
    const heightCap = maxHeight ?? 160;
    const placeAbove =
      spaceBelow < Math.min(heightCap, 160) && spaceAbove > spaceBelow;

    const next: CSSProperties = {
      position: "fixed",
      left,
      width: matchAnchorWidth ? r.width : panelW,
      minWidth: minWidth,
      maxWidth: maxWidth,
      zIndex: 300,
    };
    if (maxHeight != null) next.maxHeight = maxHeight;
    // Un solo eje `hidden` + el otro `visible` → el visible pasa a `auto` (barra).
    if (overflowY === "hidden") next.overflow = "hidden";
    else if (overflowY === "visible") next.overflow = "visible";
    else next.overflowY = overflowY;

    if (placeAbove) {
      next.bottom = vh - r.top + gap;
      next.top = "auto";
    } else {
      next.top = r.bottom + gap;
      next.bottom = "auto";
    }

    setStyle(next);
  }, [
    anchorRef,
    gap,
    matchAnchorWidth,
    align,
    minWidth,
    maxWidth,
    maxHeight,
    overflowY,
  ]);

  useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function onWin() {
      updatePosition();
    }
    window.addEventListener("resize", onWin);
    // capture: scroll en contenedores overflow del modal
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open || !onDismiss) return;
    const dismiss = onDismiss;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      if (panelEl?.contains(t)) return;
      dismiss();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onDismiss, anchorRef, panelEl]);

  if (!mounted || !open || !style) return null;

  return createPortal(
    <div
      ref={setPanelEl}
      style={style}
      className={cn(
        "rounded-md border border-border bg-surface py-1 shadow-lg",
        className,
      )}
      data-anchored-portal
    >
      {children}
    </div>,
    document.body,
  );
}
