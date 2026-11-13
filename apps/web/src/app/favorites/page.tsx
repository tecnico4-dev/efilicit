"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  favoritesSectionHref,
  readFavoritesLastSection,
} from "./favorites-last-section";

/** Redirige a la última sección de Favoritos (o licitaciones por defecto). */
export default function FavoritesIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(favoritesSectionHref(readFavoritesLastSection()));
  }, [router]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 sm:px-6">
      <p className="text-sm text-muted-foreground">Abriendo favoritos…</p>
    </main>
  );
}
