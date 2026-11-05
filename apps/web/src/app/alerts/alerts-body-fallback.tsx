/** Skeleton del cuerpo de Alertas (Suspense / loading) — marco visible sin datos. */
export function AlertsBodyFallback() {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="h-8 w-28 animate-pulse rounded bg-muted" />
        <div className="h-10 w-36 animate-pulse rounded-lg bg-muted" />
      </div>

      <div className="mt-8 border-t border-border pt-8">
        <section aria-busy="true" aria-label="Cargando alertas">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="h-5 w-28 animate-pulse rounded bg-muted" />
            <div className="h-8 w-64 max-w-full animate-pulse rounded bg-muted/70" />
          </div>
          <ul className="mt-3 divide-y divide-border border-t border-border">
            {[0, 1, 2].map((i) => (
              <li key={i} className="py-4">
                <div className="h-4 w-3/4 max-w-sm animate-pulse rounded bg-muted" />
                <div className="mt-2 h-3 w-1/2 max-w-xs animate-pulse rounded bg-muted/70" />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
