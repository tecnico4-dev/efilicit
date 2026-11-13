"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export type MarkUnreadMenuState = {
  x: number;
  y: number;
};

/**
 * Menú contextual mínimo: solo «Marcar como no leída».
 * Se cierra con Escape, click fuera o al elegir la acción.
 */
export function MarkUnreadContextMenu({
  menu,
  pending,
  onClose,
  onMarkUnread,
}: {
  menu: MarkUnreadMenuState | null;
  pending: boolean;
  onClose: () => void;
  onMarkUnread: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [menu, onClose]);

  if (!menu || typeof document === "undefined") return null;

  const left = Math.min(menu.x, window.innerWidth - 200);
  const top = Math.min(menu.y, window.innerHeight - 56);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      className="fixed z-[60] min-w-[11.5rem] rounded-md border border-border bg-surface py-1 shadow-lg"
      style={{ left, top }}
    >
      <button
        type="button"
        role="menuitem"
        disabled={pending}
        className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted disabled:opacity-50"
        onClick={onMarkUnread}
      >
        Marcar como no leída
      </button>
    </div>,
    document.body,
  );
}
