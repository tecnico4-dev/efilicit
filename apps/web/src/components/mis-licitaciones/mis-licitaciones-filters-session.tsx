"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  clearMisLicitacionesFiltersStorage,
  isMisLicitacionesPath,
} from "@/components/mis-licitaciones/mis-licitaciones-filters";

/**
 * Si sales de `/mis-licitaciones` (otra sección de la app), borra filtros de sesión.
 * Listado ↔ ficha de expediente no cuenta como salir.
 */
export function MisLicitacionesFiltersSession() {
  const pathname = usePathname();
  const wasInside = useRef(false);

  useEffect(() => {
    const inside = isMisLicitacionesPath(pathname);
    if (wasInside.current && !inside) {
      clearMisLicitacionesFiltersStorage();
    }
    wasInside.current = inside;
  }, [pathname]);

  return null;
}
