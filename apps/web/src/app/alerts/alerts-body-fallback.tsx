/** Skeleton del cuerpo de Alertas (Suspense / loading) — marco visible sin datos. */
export function AlertsBodyFallback() {
  return (
    <>
      <div className="mt-8 space-y-4 border-t border-border pt-8" aria-hidden>
        <div className="h-5 w-36 animate-pulse rounded bg-muted" />
        <div className="space-y-1">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-1 h-10 w-full animate-pulse rounded-md bg-muted/80" />
        </div>
        <div className="space-y-1">
          <div className="h-4 w-48 animate-pulse rounded bg-muted" />
          <div className="mt-1 h-10 w-full animate-pulse rounded-md bg-muted/80" />
        </div>
        <div className="space-y-1">
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          <div className="mt-1 h-10 w-full animate-pulse rounded-md bg-muted/80" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-10 animate-pulse rounded-md bg-muted/80" />
          <div className="h-10 animate-pulse rounded-md bg-muted/80" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 animate-pulse rounded-md bg-muted" />
          <div className="h-9 w-36 animate-pulse rounded-md bg-muted" />
        </div>
      </div>

      <section className="mt-10" aria-busy="true" aria-label="Cargando alertas">
        <div className="h-5 w-28 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-8 w-64 max-w-full animate-pulse rounded bg-muted/70" />
        <ul className="mt-3 divide-y divide-border border-t border-border">
          {[0, 1, 2].map((i) => (
            <li key={i} className="py-4">
              <div className="h-4 w-3/4 max-w-sm animate-pulse rounded bg-muted" />
              <div className="mt-2 h-3 w-1/2 max-w-xs animate-pulse rounded bg-muted/70" />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
