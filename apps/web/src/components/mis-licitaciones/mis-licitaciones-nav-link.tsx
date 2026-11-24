"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  loadMisLicitacionesNav,
  misLicitacionesListHref,
} from "@/components/mis-licitaciones/mis-licitaciones-nav-session";

/**
 * Enlace a Mis licitaciones que respeta tab de la sesión actual.
 * Tras salir a otra área, la sesión se limpia → Activas.
 */
export function MisLicitacionesNavLink({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <Link
      href="/mis-licitaciones"
      className={className}
      onClick={(e) => {
        e.preventDefault();
        router.push(misLicitacionesListHref(loadMisLicitacionesNav()));
      }}
    >
      {children}
    </Link>
  );
}
