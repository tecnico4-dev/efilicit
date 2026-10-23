import Link from "next/link";
import {
  formatNotificationTrashExpiry,
  isNotificationInTrashWindow,
  type FavoriteStatusNotification,
} from "@/lib/queries";
import { formatTenderStatus } from "@/lib/tender-labels";
import {
  NotificationsFolderTabs,
  type NotificationsView,
} from "./notifications-folder-tabs";
import { RestoreNotificationButton } from "./restore-notification-button";
import { TrashNotificationButton } from "./trash-notification-button";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-ES", {
      timeZone: "Europe/Madrid",
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
  userId,
}: {
  notifications: FavoriteStatusNotification[];
  view: NotificationsView;
  userId: string;
}) {
  const active = notifications.filter((n) => n.trashedAt == null);
  const inTrashWindow = notifications.filter(
    (n) => n.trashedAt != null && isNotificationInTrashWindow(n.trashedAt),
  );
  const unreadCount = active.filter((n) => n.unread).length;

  const visible =
    view === "trash"
      ? inTrashWindow
      : view === "unread"
        ? active.filter((n) => n.unread)
        : active;

  const emptyCopy =
    view === "trash"
      ? "La papelera está vacía. Los avisos eliminados se conservan aquí 30 días."
      : view === "unread"
        ? "No tienes notificaciones sin leer."
        : "Aún no tienes notificaciones.";

  return (
    <div>
      <NotificationsFolderTabs
        view={view}
        allCount={active.length}
        unreadCount={unreadCount}
        trashCount={inTrashWindow.length}
      />
      <div className="relative z-0 overflow-hidden rounded-lg rounded-tl-none border border-border bg-surface/40">
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {emptyCopy}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((n) => (
              <li key={n.eventId}>
                {view === "trash" && n.trashedAt ? (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Link
                      href={`/notifications/open?eventId=${encodeURIComponent(n.eventId)}&tenderId=${encodeURIComponent(n.tenderId)}`}
                      className="min-w-0 flex-1 transition-colors hover:opacity-90"
                    >
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
                    <div className="flex shrink-0 flex-col items-end gap-1 self-center">
                      <p className="max-w-[11rem] text-right text-xs text-muted-foreground sm:max-w-[14rem]">
                        {formatNotificationTrashExpiry(n.trashedAt)}
                      </p>
                      <RestoreNotificationButton
                        userId={userId}
                        eventId={n.eventId}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-stretch gap-1">
                    <Link
                      href={`/notifications/open?eventId=${encodeURIComponent(n.eventId)}&tenderId=${encodeURIComponent(n.tenderId)}`}
                      className="relative min-w-0 flex-1 px-4 py-3 transition-colors hover:bg-muted/60"
                    >
                      {n.unread ? (
                        <span
                          className="absolute right-2 top-1/2 size-2 -translate-y-1/2 rounded-full bg-primary shadow-sm ring-2 ring-background"
                          title="No leída"
                          aria-label="No leída"
                        />
                      ) : null}
                      <p className="pr-4 text-sm font-medium text-foreground">
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
                    <div className="flex items-center pr-2">
                      <TrashNotificationButton
                        userId={userId}
                        eventId={n.eventId}
                      />
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
