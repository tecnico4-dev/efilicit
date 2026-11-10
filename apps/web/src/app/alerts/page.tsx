import { Suspense } from "react";
import { PAGE_MAIN_CLASS } from "@/components/shell/page-width";
import { AlertsBody } from "./alerts-body";
import { AlertsBodyFallback } from "./alerts-body-fallback";

export const dynamic = "force-dynamic";

/**
 * Alertas: título + Crear alerta; bajo la raya, Mis alertas | Coincidencias.
 * El cuerpo (perfil + lista + modal) va en Suspense.
 */
export default function AlertsPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <Suspense fallback={<AlertsBodyFallback />}>
        <AlertsBody />
      </Suspense>
    </main>
  );
}
