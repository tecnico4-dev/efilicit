import Link from "next/link";
import type { FavoriteStatusNotification } from "@/lib/queries";
import { formatTenderStatus } from "@/lib/tender-labels";
import {
  NotificationsFolderTabs,
  type NotificationsView,
} from "./notifications-folder-tabs";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-ES", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function NotificationsList({
  notifications,
  view,
}: {
  notifications: FavoriteStatusNotification[];
  view: NotificationsView;
}) {
  const unreadCount = notifications.filter((n) => n.unread).length;
  const visible =
    view === "unread" ? notifications.filter((n) => n.unread) : notifications;

  return (
    <div>
      <NotificationsFolderTabs
        view={view}
        allCount={notifications.length}
        unreadCount={unreadCount}
      />
      <div className="relative z-0 overflow-hidden rounded-lg rounded-tl-none border border-border bg-surface/40">
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {view === "unread"
              ? "No tienes notificaciones sin leer."
              : "Aún no tienes notificaciones."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((n) => (
              <li key={n.eventId}>
                <Link
                  href={`/notifications/open?eventId=${encodeURIComponent(n.eventId)}&tenderId=${encodeURIComponent(n.tenderId)}`}
                  className="relative block px-4 py-3 pr-8 transition-colors hover:bg-muted/60"
                >
                  {n.unread ? (
                    <span
                      className="absolute right-3 top-1/2 size-2 -translate-y-1/2 rounded-full bg-primary shadow-sm ring-2 ring-background"
                      title="No leída"
                      aria-label="No leída"
                    />
                  ) : null}
                  <p className="text-sm font-medium text-foreground">
                    {n.title}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Estado:{" "}
                    <span className="text-foreground">
                      {formatTenderStatus(n.previousStatus)}
                    </span>
                    {" → "}
                    <span className="font-medium text-foreground">
                      {formatTenderStatus(n.newStatus)}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatWhen(n.occurredAt)}
                    {n.sourceCode ? ` · ${n.sourceCode}` : null}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
