"use client";

import type { ReactNode } from "react";
import { SearchLoadingProvider } from "./search-loading";

/** Envuelve formulario + resultados para compartir «Buscando…» en el botón. */
export function SearchWorkspace({ children }: { children: ReactNode }) {
  return <SearchLoadingProvider>{children}</SearchLoadingProvider>;
}
