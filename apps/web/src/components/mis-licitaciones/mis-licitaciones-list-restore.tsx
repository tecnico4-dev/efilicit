"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  loadMisLicitacionesNav,
  misLicitacionesListHref,
} from "@/components/mis-licitaciones/mis-licitaciones-nav-session";

/**
 * Si entras a `/mis-licitaciones` sin `?tab=` pero la sesión recuerda Histórico,
 * redirige ahí (solo mientras la sesión de Mis licitaciones sigue viva).
 */
export function MisLicitacionesListRestore({
  urlScope,
}: {
  urlScope: "active" | "historic";
}) {
  const router = useRouter();

  useEffect(() => {
    if (urlScope !== "active") return;
    const nav = loadMisLicitacionesNav();
    if (nav.scope !== "historic") return;
    router.replace(misLicitacionesListHref(nav));
  }, [urlScope, router]);

  return null;
}
