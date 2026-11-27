"use client";

import { navigateDetailTab } from "@/components/mis-licitaciones/detail-tabs";
import {
  type MissingItem,
  type MissingSeverity,
  type MissingTarget,
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

function openTarget(target: MissingTarget) {
  const tab = target.kind === "requirement" ? "requisitos" : "tareas";
  const scrollAttr =
    target.kind === "requirement"
      ? "data-offer-requirement-id"
      : "data-offer-task-id";
  navigateDetailTab({
    tab,
    scrollAttr,
    scrollId: target.id,
  });
}

export function OfferMissingPanel({ items }: { items: MissingItem[] }) {
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
              <div
                className={cn(
                  "rounded-r-md border-l-4 px-3 py-2 text-sm",
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
                <ul className="mt-1 space-y-1">
                  {m.lines.map((line) => (
                    <li key={`${line.target.kind}-${line.target.id}`}>
                      <button
                        type="button"
                        onClick={() => openTarget(line.target)}
                        className={cn(
                          "w-full rounded-sm text-left text-xs text-muted-foreground transition-colors",
                          "line-clamp-2 hover:text-foreground",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        )}
                      >
                        {line.meta}
                      </button>
                    </li>
                  ))}
                </ul>
                {m.totalCount > m.lines.length ? (
                  <p className="mt-1 text-[0.65rem] text-muted-foreground">
                    +{m.totalCount - m.lines.length} más
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
