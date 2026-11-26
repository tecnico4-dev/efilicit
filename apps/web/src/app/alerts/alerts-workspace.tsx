"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { DigestFrequency } from "@/lib/queries";
import { AlertRelatedTendersPanel } from "./alert-related-tenders-panel";
import { DigestFrequencyControl } from "./digest-frequency-control";

type AlertsTab = "alerts" | "coincidences";

/**
 * Mis alertas | Coincidencias (+ frecuencia a la derecha).
 * «Coincidencias» = misma UI que Relacionadas, dedupe por licitación
 * (basura ahí afecta a todas las colas de esa licitación).
 */
export function AlertsWorkspace({
  userId,
  digestFrequency,
  alertsList,
}: {
  userId: string;
  digestFrequency: DigestFrequency;
  alertsList: ReactNode;
}) {
  const [tab, setTab] = useState<AlertsTab>("alerts");

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 border-b border-border">
        <div
          className="flex flex-wrap items-end gap-1"
          role="tablist"
          aria-label="Secciones de alertas"
        >
          <SectionTab
            active={tab === "alerts"}
            label="Mis alertas"
            onSelect={() => setTab("alerts")}
          />
          <SectionTab
            active={tab === "coincidences"}
            label="Coincidencias"
            onSelect={() => setTab("coincidences")}
          />
        </div>
        <div className="pb-2">
          <DigestFrequencyControl
            userId={userId}
            initialFrequency={digestFrequency}
          />
        </div>
      </div>

      {/* -mt-px: la pestaña activa solapa el borde y se une al panel. */}
      <div className="-mt-px" role="tabpanel">
        {tab === "alerts" ? (
          alertsList
        ) : (
          <AlertRelatedTendersPanel
            variant="embedded"
            userId={userId}
            open
            onClose={() => setTab("alerts")}
          />
        )}
      </div>
    </section>
  );
}

function SectionTab({
  active,
  label,
  onSelect,
}: {
  active: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={cn(
        "relative z-10 -mb-px inline-flex items-center rounded-t-lg border px-3.5 py-2 text-sm font-medium transition-colors",
        active
          ? "border-border border-b-background bg-background text-foreground"
          : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
