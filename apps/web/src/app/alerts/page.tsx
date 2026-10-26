import { Suspense } from "react";
import { PAGE_MAIN_CLASS } from "@/components/shell/page-width";
import { AlertsBody } from "./alerts-body";
import { AlertsBodyFallback } from "./alerts-body-fallback";

export const dynamic = "force-dynamic";

/**
 * Título al instante; formulario + lista detrás de Suspense (perfil + query).
 */
export default function AlertsPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Alertas
      </h1>

      <Suspense fallback={<AlertsBodyFallback />}>
        <AlertsBody />
      </Suspense>
    </main>
  );
}
