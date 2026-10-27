import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Error de página/sección (patrón notificaciones / login). */
export function ErrorState({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      role="alert"
      className={cn(
        "rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Vacío de lista/sección (card dashed). */
export function EmptyState({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "rounded-lg border border-dashed border-border bg-surface/50 px-4 py-8 text-center text-sm text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}
