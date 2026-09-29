import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase/client";
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

function MatchKindBadge({ kind }: { kind: string }) {
  const label =
    kind === "fts" ? "FTS" : kind === "trgm" ? "errata" : kind === "filter" ? "filtro" : kind;
  return (
    <span className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-700">
      {label}
    </span>
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
  if (error) {
    return (
      <p className="mt-8 rounded-md bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
        Error al buscar: {error}
      </p>
    );
  }

  if (!searched) {
    return (
      <p className="mt-8 text-sm text-zinc-600">
        Escribe un término (p. ej. <code className="font-mono">mantenimiento software</code>) o
        una errata (<code className="font-mono">mantnimiento softwre</code>) y pulsa Buscar.
      </p>
    );
  }

  if (rows.length === 0) {
    return <p className="mt-8 text-sm text-zinc-600">Sin resultados para estos criterios.</p>;
  }

  return (
    <ul className="mt-8 divide-y divide-zinc-200 border-t border-zinc-200">
      {rows.map((row) => (
        <li key={row.id} className="py-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-base font-medium text-zinc-900">{row.title}</h2>
            <MatchKindBadge kind={row.match_kind} />
          </div>
          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600">
            <div>
              <dt className="inline text-zinc-500">Importe: </dt>
              <dd className="inline">{formatMoney(row.estimated_value, row.currency)}</dd>
            </div>
            <div>
              <dt className="inline text-zinc-500">CPV: </dt>
              <dd className="inline font-mono">{row.cpv_code ?? "—"}</dd>
            </div>
            <div>
              <dt className="inline text-zinc-500">Estado: </dt>
              <dd className="inline">{row.status ?? "—"}</dd>
            </div>
            <div>
              <dt className="inline text-zinc-500">rank: </dt>
              <dd className="inline font-mono">{row.rank.toFixed(3)}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
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

  if (hasParams) {
    try {
      const client = createSupabaseClient();
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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">
            <Link href="/" className="hover:underline">
              EfiLicit
            </Link>
            <span className="mx-2">/</span>
            Búsqueda
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
            Buscar licitaciones
          </h1>
        </div>
      </header>

      <p className="mt-2 text-sm text-zinc-600">
        Semana 5 — UI mínima sobre el modelo canónico (FTS + erratas + filtros).
      </p>

      <form method="get" className="mt-8 space-y-4" role="search">
        <div>
          <label htmlFor="q" className="block text-sm font-medium text-zinc-800">
            Texto
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="mantenimiento software"
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="cpv" className="block text-sm font-medium text-zinc-800">
              CPV (prefijo)
            </label>
            <input
              id="cpv"
              name="cpv"
              type="text"
              inputMode="numeric"
              defaultValue={cpv}
              placeholder="72000000"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-zinc-500"
            />
          </div>
          <div>
            <label htmlFor="min" className="block text-sm font-medium text-zinc-800">
              Importe mín.
            </label>
            <input
              id="min"
              name="min"
              type="number"
              min={0}
              step={1}
              defaultValue={minRaw}
              placeholder="10000"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>
          <div>
            <label htmlFor="max" className="block text-sm font-medium text-zinc-800">
              Importe máx.
            </label>
            <input
              id="max"
              name="max"
              type="number"
              min={0}
              step={1}
              defaultValue={maxRaw}
              placeholder="500000"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>
        </div>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Buscar
        </button>
      </form>

      <ResultsList rows={rows} error={error} searched={hasParams} />
    </main>
  );
}
