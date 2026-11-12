import Link from "next/link";

/** Vacío de licitaciones favoritas: «búsqueda» enlaza a /search. */
export function EmptyFavoritesTendersHint() {
  return (
    <>
      Aún no tienes licitaciones en favoritos. Ábrelas desde la{" "}
      <Link href="/search" className="font-medium text-link hover:underline">
        búsqueda
      </Link>{" "}
      y pulsa «Guardar en favoritos».
    </>
  );
}

/** Vacío de búsquedas guardadas: «búsqueda» enlaza a /search. */
export function EmptySavedSearchesHint() {
  return (
    <>
      Ninguna aún. Puedes guardar criterios desde la{" "}
      <Link href="/search" className="font-medium text-link hover:underline">
        búsqueda
      </Link>
      .
    </>
  );
}

/** Vacío de Común: se añaden desde el listado ampliado de favoritos. */
export function EmptySharedFavoritesHint() {
  return (
    <>
      Aún no hay licitaciones en Común. Ábrelas desde{" "}
      <Link
        href="/favorites/tenders"
        className="font-medium text-link hover:underline"
      >
        Licitaciones favoritas
      </Link>{" "}
      y pulsa el avión para compartirlas con el equipo.
    </>
  );
}
