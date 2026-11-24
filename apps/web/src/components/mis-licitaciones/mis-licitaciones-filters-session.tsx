"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  clearMisLicitacionesFiltersStorage,
  isMisLicitacionesPath,
} from "@/components/mis-licitaciones/mis-licitaciones-filters";
import { clearMisLicitacionesNavStorage } from "@/components/mis-licitaciones/mis-licitaciones-nav-session";

/**
 * Si sales de `/mis-licitaciones` (otra sección de la app), borra filtros y
 * navegación de sesión (tab/vista). Listado ↔ expediente no cuenta como salir.
 */
export function MisLicitacionesFiltersSession() {
  const pathname = usePathname();
  const wasInside = useRef(false);

  useEffect(() => {
    const inside = isMisLicitacionesPath(pathname);
    if (wasInside.current && !inside) {
      clearMisLicitacionesFiltersStorage();
      clearMisLicitacionesNavStorage();
    }
    wasInside.current = inside;
  }, [pathname]);

  return null;
}
