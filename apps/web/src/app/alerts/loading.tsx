import { PAGE_MAIN_CLASS } from "@/components/shell/page-width";
import { AlertsBodyFallback } from "./alerts-body-fallback";

/** Al click del menú: ya parece Alertas (no un spinner genérico). */
export default function AlertsLoading() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Alertas
      </h1>
      <AlertsBodyFallback />
    </main>
  );
}
