import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchTenders, type SearchTenderRow } from "@/lib/queries";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function formatMoney(value: number | null, currency: string): string {
  if (value == null) return "—";
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function MatchKindBadge({ kind }: { kind: string }) {
  const label =
    kind === "fts"
      ? "Texto"
      : kind === "trgm"
        ? "Errata"
        : kind === "filter"
          ? "Filtro"
          : kind;

  return (
    <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-link">
      {label}
    </span>
  );
}

function EmptyState({ searched }: { searched: boolean }) {
  if (!searched) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface/60 px-5 py-10 text-center">
        <p className="text-sm font-medium text-foreground">
          Empieza una búsqueda
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Usa texto libre, un código CPV o un rango de importe. También
          toleramos erratas tipográficas.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface/60 px-5 py-10 text-center">
      <p className="text-sm font-medium text-foreground">Sin resultados</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Prueba otros términos, un CPV más corto o amplía el rango de importe.
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div
      className="rounded-2xl border border-destructive/40 bg-surface px-5 py-4"
      role="alert"
    >
      <p className="text-sm font-semibold text-destructive">
        No se ha podido completar la búsqueda
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function ResultsList({
  rows,
  error,
  searched,
}: {
  rows: SearchTenderRow[];
  error: string | null;
  searched: boolean;
}) {
  if (error) return <ErrorState message={error} />;
  if (!searched || rows.length === 0) {
    return <EmptyState searched={searched} />;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {rows.length} resultado{rows.length === 1 ? "" : "s"}
      </p>
      <ul className="space-y-3">
        {rows.map((row) => {
          const pub = formatDate(row.publication_date);
          const deadline = formatDate(row.deadline_at);

          return (
            <li
              key={row.id}
              className="rounded-2xl border border-border/80 bg-surface p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="min-w-0 flex-1 text-base font-semibold tracking-tight text-foreground sm:text-lg">
                  {row.title}
                </h2>
                <MatchKindBadge kind={row.match_kind} />
              </div>

              {row.description ? (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {row.description}
                </p>
              ) : null}

              <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
                <div>
                  <dt className="inline text-muted-foreground">Importe · </dt>
                  <dd className="inline font-medium text-foreground">
                    {formatMoney(row.estimated_value, row.currency)}
                  </dd>
                </div>
                <div>
                  <dt className="inline text-muted-foreground">CPV · </dt>
                  <dd className="inline font-mono text-foreground">
                    {row.cpv_code ?? "—"}
                  </dd>
                </div>
                {row.status ? (
                  <div>
                    <dt className="inline text-muted-foreground">Estado · </dt>
                    <dd className="inline text-foreground">{row.status}</dd>
                  </div>
                ) : null}
                {pub ? (
                  <div>
                    <dt className="inline text-muted-foreground">Publicación · </dt>
                    <dd className="inline text-foreground">{pub}</dd>
                  </div>
                ) : null}
                {deadline ? (
                  <div>
                    <dt className="inline text-muted-foreground">Plazo · </dt>
                    <dd className="inline text-foreground">{deadline}</dd>
                  </div>
                ) : null}
              </dl>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = first(params.q).trim();
  const cpv = first(params.cpv).trim();
  const minRaw = first(params.min).trim();
  const maxRaw = first(params.max).trim();
  const min = minRaw === "" ? undefined : Number(minRaw);
  const max = maxRaw === "" ? undefined : Number(maxRaw);

  const hasParams =
    q !== "" ||
    cpv !== "" ||
    (min != null && !Number.isNaN(min)) ||
    (max != null && !Number.isNaN(max));

  let rows: SearchTenderRow[] = [];
  let error: string | null = null;
  let isAuthenticated = false;

  try {
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    isAuthenticated = Boolean(user);
  } catch {
    isAuthenticated = false;
  }

  if (hasParams) {
    try {
      const client = await createSupabaseServerClient();
      const result = await searchTenders(client, {
        query: q || undefined,
        criteria: {
          version: 1,
          cpv_codes: cpv ? [cpv] : undefined,
          estimated_value_min:
            min != null && !Number.isNaN(min) ? min : undefined,
          estimated_value_max:
            max != null && !Number.isNaN(max) ? max : undefined,
        },
        limit: 20,
      });
      if (result.error) {
        error = result.error.message;
      } else {
        rows = result.data ?? [];
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Buscar licitaciones
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Encuentra contratos por texto, CPV o importe sobre el catálogo
          canónico.
        </p>
      </header>

      <form
        method="get"
        className="mt-6 space-y-4 rounded-2xl border border-border/80 bg-surface p-4 shadow-sm sm:mt-8 sm:p-5"
        role="search"
      >
        <div>
          <label
            htmlFor="q"
            className="mb-1 block text-sm text-muted-foreground"
          >
            Texto
          </label>
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            autoComplete="off"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label
              htmlFor="cpv"
              className="mb-1 block text-sm text-muted-foreground"
            >
              CPV (prefijo)
            </label>
            <Input
              id="cpv"
              name="cpv"
              type="text"
              inputMode="numeric"
              defaultValue={cpv}
              className="font-mono"
            />
          </div>
          <div>
            <label
              htmlFor="min"
              className="mb-1 block text-sm text-muted-foreground"
            >
              Importe mín. (€)
            </label>
            <Input
              id="min"
              name="min"
              type="number"
              min={0}
              step={1}
              defaultValue={minRaw}
            />
          </div>
          <div>
            <label
              htmlFor="max"
              className="mb-1 block text-sm text-muted-foreground"
            >
              Importe máx. (€)
            </label>
            <Input
              id="max"
              name="max"
              type="number"
              min={0}
              step={1}
              defaultValue={maxRaw}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button type="submit">Buscar</Button>
          {hasParams ? (
            <Button href="/search" variant="ghost">
              Limpiar
            </Button>
          ) : null}
        </div>
      </form>

      <section className="mt-8" aria-live="polite">
        <ResultsList rows={rows} error={error} searched={hasParams} />
      </section>

      {!hasParams && isAuthenticated ? (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          ¿Prefieres alertas automáticas?{" "}
          <Link href="/alerts" className="font-medium text-link hover:underline">
            Configúralas aquí
          </Link>
        </p>
      ) : null}
      {!hasParams && !isAuthenticated ? (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          ¿Quieres alertas automáticas?{" "}
          <Link href="/login?next=/alerts" className="font-medium text-link hover:underline">
            Inicia sesión
          </Link>
        </p>
      ) : null}
    </main>
  );
}
