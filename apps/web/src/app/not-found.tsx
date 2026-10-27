import Link from "next/link";
import { PAGE_MAIN_CLASS } from "@/components/shell/page-width";
import { EmptyState } from "@/components/ui/state-message";

export default function NotFound() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Página no encontrada
      </h1>
      <EmptyState className="mt-8">
        La ruta no existe o ya no está disponible.{" "}
        <Link href="/" className="font-medium text-link hover:underline">
          Ir al inicio
        </Link>
      </EmptyState>
    </main>
  );
}
