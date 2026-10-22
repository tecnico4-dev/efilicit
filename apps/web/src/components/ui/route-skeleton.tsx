import { PAGE_MAIN_CLASS } from "@/components/shell/page-width";

/** Skeleton de ruta (Suspense `loading.tsx`). */
export function RouteSkeleton({ label = "Cargando…" }: { label?: string }) {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="mt-2 h-4 w-72 max-w-full animate-pulse rounded bg-muted" />
      <div className="mt-8 h-40 animate-pulse rounded-2xl border border-border bg-surface" />
      <p className="mt-8 text-sm text-muted-foreground">{label}</p>
    </main>
  );
}
