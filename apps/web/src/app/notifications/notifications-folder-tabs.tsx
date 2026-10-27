import { cn } from "@/lib/cn";

export type NotificationsView = "all" | "unread" | "trash";

/**
 * Pestañas tipo separador de ficheros encima de la lista del buzón.
 * Filtro en cliente (sin navegación RSC).
 */
export function NotificationsFolderTabs({
  view,
  allCount,
  unreadCount,
  trashCount,
  onViewChange,
}: {
  view: NotificationsView;
  allCount: number;
  unreadCount: number;
  trashCount: number;
  onViewChange: (next: NotificationsView) => void;
}) {
  return (
    <div
      className="flex flex-wrap items-end gap-1 px-1"
      role="tablist"
      aria-label="Filtro"
    >
      <FolderTab
        active={view === "all"}
        label="Todas"
        count={allCount}
        onSelect={() => onViewChange("all")}
      />
      <FolderTab
        active={view === "unread"}
        label="No leídas"
        count={unreadCount}
        onSelect={() => onViewChange("unread")}
      />
      <FolderTab
        active={view === "trash"}
        label="Papelera"
        count={trashCount}
        onSelect={() => onViewChange("trash")}
      />
    </div>
  );
}

function FolderTab({
  active,
  label,
  count,
  onSelect,
}: {
  active: boolean;
  label: string;
  count: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={cn(
        "relative z-10 -mb-px inline-flex items-center gap-1.5 rounded-t-lg border px-3.5 py-2 text-sm font-medium transition-colors",
        active
          ? "border-border border-b-[color-mix(in_srgb,var(--surface)_40%,transparent)] bg-surface/40 text-foreground"
          : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
      <span
        className={cn(
          "min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums",
          active
            ? "bg-primary/15 text-primary-dark"
            : "bg-background/80 text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}
