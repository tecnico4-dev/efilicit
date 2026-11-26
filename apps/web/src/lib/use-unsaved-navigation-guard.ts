"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Bloquea salir de la vista mientras hay edición pendiente.
 * - Clicks a Links / <a> internos → `confirmLeave` (modal propio).
 * - Recarga / cerrar pestaña / URL externa → `beforeunload` nativo (solo si `dirty`).
 * - Atrás del navegador → trap + `confirmLeave`.
 */
export function useUnsavedNavigationGuard({
  enabled,
  dirty,
  confirmLeave,
}: {
  /** Activo en modo edición (aunque aún no haya cambios). */
  enabled: boolean;
  /** Hay cambios sin aplicar → también beforeunload. */
  dirty: boolean;
  confirmLeave: () => Promise<boolean>;
}) {
  const router = useRouter();
  const confirmRef = useRef(confirmLeave);
  confirmRef.current = confirmLeave;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const bypassPopRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    function isModifiedClick(e: MouseEvent): boolean {
      return (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      );
    }

    function leavingAnchor(e: MouseEvent): HTMLAnchorElement | null {
      if (isModifiedClick(e)) return null;
      const el =
        e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(el instanceof HTMLAnchorElement)) return null;
      if (el.hasAttribute("download")) return null;
      if (el.target && el.target !== "_self") return null;

      let url: URL;
      try {
        url = new URL(el.href, window.location.href);
      } catch {
        return null;
      }
      if (url.origin !== window.location.origin) return null;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return null;
      }
      return el;
    }

    async function onClickCapture(e: MouseEvent) {
      const anchor = leavingAnchor(e);
      if (!anchor) return;

      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") {
        e.stopImmediatePropagation();
      }

      const next = `${new URL(anchor.href).pathname}${new URL(anchor.href).search}${new URL(anchor.href).hash}`;
      const ok = await confirmRef.current();
      if (ok) {
        router.push(next);
      }
    }

    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }

    document.addEventListener("click", onClickCapture, true);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [enabled, router]);

  // Atrás / adelante del historial (solo con cambios pendientes).
  useEffect(() => {
    if (!enabled || !dirty) return;

    history.pushState({ __efilicitUnsaved: 1 }, "", window.location.href);

    async function onPopState() {
      if (bypassPopRef.current) {
        bypassPopRef.current = false;
        return;
      }
      // Reponer la entrada actual y preguntar.
      history.pushState({ __efilicitUnsaved: 1 }, "", window.location.href);
      const ok = await confirmRef.current();
      if (!ok) return;
      bypassPopRef.current = true;
      history.back();
    }

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [enabled, dirty]);
}
