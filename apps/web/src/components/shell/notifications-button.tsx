"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/** Sobre cerrado (buzón de notificaciones). */
function MailboxIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="2.5" y="5" width="19" height="14" rx="1.5" />
      <path d="m2.5 7.5 8.7 5.6a1.4 1.4 0 0 0 1.6 0l8.7-5.6" />
      <path d="m2.5 17.5 6.2-5" />
      <path d="m21.5 17.5-6.2-5" />
    </svg>
  );
}

/**
 * Acceso a Notificaciones (buzón).
 * `hasUnread`: hay avisos de favoritos sin abrir (notification_reads).
 */
export function NotificationsButton({
  hasUnread = false,
}: {
  hasUnread?: boolean;
}) {
  const pathname = usePathname() || "/";
  const active = pathname.startsWith("/notifications");

  return (
    <Link
      href="/notifications"
      aria-label={
        hasUnread
          ? "Notificaciones (hay novedades)"
          : "Notificaciones"
      }
      className={cn(
        "relative inline-flex size-9 items-center justify-center rounded-full border border-border/80 bg-background text-foreground shadow-sm transition-colors hover:bg-muted",
        active && "ring-2 ring-ring ring-offset-2 ring-offset-background",
      )}
    >
      <MailboxIcon className="size-4" />
      {hasUnread ? (
        <span
          className="absolute right-1 top-1 size-2 rounded-full bg-primary shadow-sm ring-2 ring-background"
          aria-hidden
        />
      ) : null}
    </Link>
  );
}
