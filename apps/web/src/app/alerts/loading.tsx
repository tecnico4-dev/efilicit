import { PAGE_MAIN_CLASS } from "@/components/shell/page-width";
import { AlertsBodyFallback } from "./alerts-body-fallback";

/** Al click del menú: ya parece Alertas (no un spinner genérico). */
export default function AlertsLoading() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <AlertsBodyFallback />
    </main>
  );
}
