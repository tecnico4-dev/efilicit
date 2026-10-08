import Link from "next/link";

export default function TenderNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Licitación no encontrada
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        No existe o no está disponible en el catálogo canónico.
      </p>
      <p className="mt-6 text-sm">
        <Link href="/search" className="font-medium text-link hover:underline">
          Volver a la búsqueda
        </Link>
      </p>
    </main>
  );
}
