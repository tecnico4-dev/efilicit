"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const TABS = [
  { id: "resumen", label: "Resumen" },
  { id: "requisitos", label: "Requisitos" },
  { id: "sobres", label: "Sobres" },
  { id: "pliegos", label: "Pliegos y fuentes" },
  { id: "equipo", label: "Equipo" },
  { id: "calendario", label: "Calendario" },
  { id: "bitacora", label: "Bitácora" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function DetailTabs({
  panes,
}: {
  panes: Record<TabId, ReactNode>;
}) {
  const [tab, setTab] = useState<TabId>("resumen");

  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-border pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-t-md px-3 py-1.5 text-sm transition-colors",
              tab === t.id
                ? "border-b-2 border-primary font-semibold text-primary-dark"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-4">{panes[tab]}</div>
    </div>
  );
}
