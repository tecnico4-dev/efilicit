import { Suspense } from "react";
import { UndoToastProvider } from "@/components/undo-toast";
import { AuthenticatedChrome } from "./authenticated-chrome";

/**
 * Shell de layout: no espera auth ni badge antes de pintar `{children}`.
 * Cabecera y puntito de no leídas llegan en streaming (Suspense).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-full flex-1 flex-col bg-background text-foreground">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgb(82,185,216,0.18),transparent_45%)]"
        aria-hidden
      />
      <UndoToastProvider>
        <div className="relative flex min-h-full flex-1 flex-col">
          <Suspense
            fallback={
              <header
                className="sticky top-0 z-40 h-[3.25rem] border-b border-border/80 bg-surface/95"
                aria-hidden
              />
            }
          >
            <AuthenticatedChrome />
          </Suspense>
          <div className="flex flex-1 flex-col">{children}</div>
        </div>
      </UndoToastProvider>
    </div>
  );
}
