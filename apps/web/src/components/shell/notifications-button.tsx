"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

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
      <path d="M4 9h12a3 3 0 0 1 3 3v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9z" />
      <path d="M4 9V7a2 2 0 0 1 2-2h7" />
      <path d="M16 4h3a1 1 0 0 1 1 1v4" />
      <path d="M8 13h4" />
    </svg>
  );
}

/**
 * Acceso a Notificaciones (buzón).
 * `hasUnread` controla el puntito azul (placeholder visual por ahora).
 */
export function NotificationsButton({
  hasUnread = true,
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
