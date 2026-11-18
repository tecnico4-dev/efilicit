"use client";

import { cn } from "@/lib/cn";

export type RecommendationsViewMode = "lista" | "kanban";

/** Segmento Lista | Kanban (mismo patrón que Mis licitaciones). */
export function RecommendationsViewToggle({
  view,
  onChange,
}: {
  view: RecommendationsViewMode;
  onChange: (next: RecommendationsViewMode) => void;
}) {
  return (
    <div
      className="inline-flex overflow-hidden rounded-md border border-border bg-background"
      role="group"
      aria-label="Vista del listado"
    >
      <button
        type="button"
        onClick={() => onChange("lista")}
        className={cn(
          "px-3 py-1.5 text-sm font-medium transition-colors",
          view === "lista"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        Lista
      </button>
      <button
        type="button"
        onClick={() => onChange("kanban")}
        className={cn(
          "px-3 py-1.5 text-sm font-medium transition-colors",
          view === "kanban"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        Kanban
      </button>
    </div>
  );
}
