"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDateMadrid } from "@/lib/datetime";
import {
  formatNotificationTrashExpiry,
  isNotificationInTrashWindow,
  type DigestInboxNotification,
  type FavoriteStatusNotification,
} from "@/lib/queries";
import { formatTenderStatus } from "@/lib/tender-labels";
import { DigestTendersPanel } from "./digest-tenders-panel";
import {
  NotificationsFolderTabs,
  type NotificationsView,
} from "./notifications-folder-tabs";
import { RestoreDigestNotificationButton } from "./restore-digest-notification-button";
import { RestoreNotificationButton } from "./restore-notification-button";
import { TrashDigestNotificationButton } from "./trash-digest-notification-button";
import { TrashNotificationButton } from "./trash-notification-button";

export type InboxItem =
  | { kind: "favorite_status"; sortAt: string; data: FavoriteStatusNotification }
  | { kind: "digest"; sortAt: string; data: DigestInboxNotification };

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

function syncViewInUrl(next: NotificationsView) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (next === "all") {
    url.searchParams.delete("view");
  } else {
    url.searchParams.set("view", next);
  }
  window.history.replaceState(window.history.state, "", url.pathname + url.search);
}

function digestCopy(n: DigestInboxNotification): string {
  const freq = n.frequency === "semanal" ? "semanal" : "diario";
  const nTenders = n.tenderCount;
  const licit =
    nTenders === 1
      ? "1 licitación nueva que podría interesarte"
      : `${nTenders} licitaciones nuevas que podrían interesarte`;
  return `Se ha enviado tu email ${freq}: ${licit}`;
}

export function NotificationsList({
  items,
  initialView,
  userId,
}: {
  items: InboxItem[];
  initialView: NotificationsView;
  userId: string;
}) {
  const router = useRouter();
  const [view, setView] = useState<NotificationsView>(initialView);
  const [openDigest, setOpenDigest] =
    useState<DigestInboxNotification | null>(null);

  function onViewChange(next: NotificationsView) {
    setView(next);
    syncViewInUrl(next);
  }

  const active = items.filter((n) => {
    if (n.kind === "favorite_status") return n.data.trashedAt == null;
    return n.data.trashedAt == null;
  });
  const inTrashWindow = items.filter((n) => {
    const trashedAt =
      n.kind === "favorite_status" ? n.data.trashedAt : n.data.trashedAt;
    return trashedAt != null && isNotificationInTrashWindow(trashedAt);
  });
  const unreadCount = active.filter((n) =>
    n.kind === "favorite_status" ? n.data.unread : n.data.unread,
  ).length;

  const visible =
    view === "trash"
      ? inTrashWindow
      : view === "unread"
        ? active.filter((n) =>
            n.kind === "favorite_status" ? n.data.unread : n.data.unread,
          )
        : active;

  const emptyCopy =
    view === "trash"
      ? "La papelera está vacía. Los avisos eliminados se conservan aquí 30 días."
      : view === "unread"
        ? "No tienes notificaciones sin leer."
        : "Aún no tienes notificaciones.";

  function closeDigestPanel() {
    setOpenDigest(null);
    router.refresh();
  }

  return (
    <div>
      <NotificationsFolderTabs
        view={view}
        allCount={active.length}
        unreadCount={unreadCount}
        trashCount={inTrashWindow.length}
        onViewChange={onViewChange}
      />
      <div className="relative z-0 overflow-hidden rounded-lg rounded-tl-none border border-border bg-surface/40">
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {emptyCopy}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((item) =>
              item.kind === "digest" ? (
                <DigestRow
                  key={`digest-${item.data.id}`}
                  n={item.data}
                  userId={userId}
                  inTrash={view === "trash"}
                  onOpen={() => setOpenDigest(item.data)}
                />
              ) : (
                <FavoriteStatusRow
                  key={`fav-${item.data.eventId}`}
                  n={item.data}
                  userId={userId}
                  inTrash={view === "trash"}
                />
              ),
            )}
          </ul>
        )}
      </div>

      {openDigest ? (
        <DigestTendersPanel
          digestId={openDigest.id}
          userId={userId}
          tenderIds={openDigest.tenderIds}
          title="Licitaciones del correo"
          subtitle={digestCopy(openDigest)}
          open
          onClose={closeDigestPanel}
        />
      ) : null}
    </div>
  );
}

function DigestRow({
  n,
  userId,
  inTrash,
  onOpen,
}: {
  n: DigestInboxNotification;
  userId: string;
  inTrash: boolean;
  onOpen: () => void;
}) {
  if (inTrash && n.trashedAt) {
    return (
      <li>
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={onOpen}
            className="min-w-0 flex-1 text-left transition-colors hover:opacity-90"
          >
            <p className="text-sm font-medium text-foreground">{digestCopy(n)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDateMadrid(n.sentAt)}
            </p>
          </button>
          <div className="flex shrink-0 flex-col items-end gap-1 self-center">
            <p className="max-w-[11rem] text-right text-xs text-muted-foreground sm:max-w-[14rem]">
              {formatNotificationTrashExpiry(n.trashedAt)}
            </p>
            <RestoreDigestNotificationButton
              userId={userId}
              digestId={n.id}
            />
          </div>
        </div>
      </li>
    );
  }

  return (
    <li>
      <div className="flex items-stretch gap-1">
        <button
          type="button"
          onClick={onOpen}
          className="relative min-w-0 flex-1 px-4 py-3 text-left transition-colors hover:bg-muted/60"
        >
          {n.unread ? (
            <span
              className="absolute right-2 top-1/2 size-2 -translate-y-1/2 rounded-full bg-primary shadow-sm ring-2 ring-background"
              title="No leída"
              aria-label="No leída"
            />
          ) : null}
          <p className="pr-4 text-sm font-medium text-foreground">
            {digestCopy(n)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDateMadrid(n.sentAt)}
          </p>
        </button>
        <div className="flex items-center pr-2">
          <TrashDigestNotificationButton userId={userId} digestId={n.id} />
        </div>
      </div>
    </li>
  );
}

function FavoriteStatusRow({
  n,
  userId,
  inTrash,
}: {
  n: FavoriteStatusNotification;
  userId: string;
  inTrash: boolean;
}) {
  if (inTrash && n.trashedAt) {
    return (
      <li>
        <div className="flex items-center gap-3 px-4 py-3">
          <Link
            href={`/notifications/open?eventId=${encodeURIComponent(n.eventId)}&tenderId=${encodeURIComponent(n.tenderId)}`}
            className="min-w-0 flex-1 transition-colors hover:opacity-90"
          >
            <p className="text-sm font-medium text-foreground">{n.title}</p>
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
            <RestoreNotificationButton userId={userId} eventId={n.eventId} />
          </div>
        </div>
      </li>
    );
  }

  return (
    <li>
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
          <p className="pr-4 text-sm font-medium text-foreground">{n.title}</p>
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
          <TrashNotificationButton userId={userId} eventId={n.eventId} />
        </div>
      </div>
    </li>
  );
}
