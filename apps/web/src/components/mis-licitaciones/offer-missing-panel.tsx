"use client";

import { navigateDetailTab } from "@/components/mis-licitaciones/detail-tabs";
import {
  type MissingItem,
  type MissingSeverity,
} from "@/components/mis-licitaciones/offer-missing-items";
import { cn } from "@/lib/cn";

export type { MissingItem, MissingSeverity } from "@/components/mis-licitaciones/offer-missing-items";

const SEVERITY_LABEL: Record<MissingSeverity, string> = {
  bloqueante: "BLOQUEANTE",
  plazo: "PLAZO",
  riesgo: "RIESGO",
};

const SEVERITY_LABEL_CLASS: Record<MissingSeverity, string> = {
  bloqueante: "text-destructive",
  plazo: "text-sky-700 dark:text-sky-300",
  riesgo: "text-amber-800 dark:text-amber-300",
};

export function OfferMissingPanel({ items }: { items: MissingItem[] }) {
  function onOpen(item: MissingItem) {
    const tab = item.target.kind === "requirement" ? "requisitos" : "tareas";
    const scrollAttr =
      item.target.kind === "requirement"
        ? "data-offer-requirement-id"
        : "data-offer-task-id";
    navigateDetailTab({
      tab,
      scrollAttr,
      scrollId: item.target.id,
    });
  }

  return (
    <aside className="h-fit rounded-xl border border-border bg-surface p-4 lg:sticky lg:top-24">
      <h2 className="text-sm font-semibold text-foreground">Qué falta</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No hay pendientes detectados.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onOpen(m)}
                className={cn(
                  "w-full rounded-r-md border-l-4 px-3 py-2 text-left text-sm transition-colors",
                  "hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  m.tone === "bad" &&
                    "border-destructive bg-destructive/10 text-foreground",
                  m.tone === "warn" &&
                    "border-amber-500 bg-amber-50 text-foreground dark:bg-amber-950/30",
                )}
              >
                <p
                  className={cn(
                    "text-[0.65rem] font-semibold uppercase tracking-wide",
                    SEVERITY_LABEL_CLASS[m.severity],
                  )}
                >
                  {SEVERITY_LABEL[m.severity]}
                </p>
                <p className="mt-0.5 font-medium leading-snug">{m.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{m.meta}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
