import Link from "next/link";
import { PAGE_MAIN_CLASS } from "@/components/shell/page-width";
import { EmptyState } from "@/components/ui/state-message";

export default function TenderNotFound() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Licitación no encontrada
      </h1>
      <EmptyState className="mt-8">
        No existe o no está disponible en el catálogo canónico.{" "}
        <Link href="/search" className="font-medium text-link hover:underline">
          Volver a la búsqueda
        </Link>
      </EmptyState>
    </main>
  );
}
