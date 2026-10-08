import Link from "next/link";
import { FavoriteHeartButton } from "@/components/favorites/favorite-heart-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getOwnProfile,
  listOwnFavoriteTenderIds,
  searchTenders,
  type SearchTenderRow,
} from "@/lib/queries";
import { SaveSearchButton } from "./save-search-button";
import { SearchForm } from "./search-form";

function backFromSavedSearch(from: string): { href: string; label: string } | null {
  if (from === "favorites-searches") {
    return {
      href: "/favorites/searches",
      label: "← Volver a la lista de búsquedas guardadas",
    };
  }
  if (from === "favorites") {
    return {
      href: "/favorites",
      label: "← Volver a la lista de favoritos",
    };
  }
  return null;
}

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
    <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
      {label}
    </span>
  );
}

function tenderHrefFromSearch(
  tenderId: string,
  filters: { q: string; cpv: string; minRaw: string; maxRaw: string },
): string {
  const params = new URLSearchParams({ from: "search" });
  if (filters.q) params.set("q", filters.q);
  if (filters.cpv) params.set("cpv", filters.cpv);
  if (filters.minRaw) params.set("min", filters.minRaw);
  if (filters.maxRaw) params.set("max", filters.maxRaw);
  return `/tenders/${tenderId}?${params.toString()}`;
}

function ResultsList({
  rows,
  error,
  searched,
  filters,
  profileUserId,
  favoritedIds,
}: {
  rows: SearchTenderRow[];
  error: string | null;
  searched: boolean;
  filters: { q: string; cpv: string; minRaw: string; maxRaw: string };
  profileUserId: string | null;
  favoritedIds: Set<string>;
}) {
  if (error) {
    return (
      <p className="mt-8 rounded-md bg-surface px-4 py-3 text-sm text-destructive" role="alert">
        Error al buscar: {error}
      </p>
    );
  }

  if (!searched) {
    return null;
  }

  if (rows.length === 0) {
    return <p className="mt-8 text-sm text-muted-foreground">Sin resultados para estos criterios.</p>;
  }

  return (
    <ul className="mt-8 divide-y divide-border border-t border-border">
      {rows.map((row) => (
        <li key={row.id} className="py-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="text-base font-medium text-foreground">
                  <Link
                    href={tenderHrefFromSearch(row.id, filters)}
                    className="text-foreground hover:text-link hover:underline"
                  >
                    {row.title}
                  </Link>
                </h2>
                <MatchKindBadge kind={row.match_kind} />
              </div>
              <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <div>
                  <dt className="inline text-muted-foreground">Importe: </dt>
                  <dd className="inline">{formatMoney(row.estimated_value, row.currency)}</dd>
                </div>
                <div>
                  <dt className="inline text-muted-foreground">CPV: </dt>
                  <dd className="inline font-mono">{row.cpv_code ?? "—"}</dd>
                </div>
                <div>
                  <dt className="inline text-muted-foreground">Estado: </dt>
                  <dd className="inline">{row.status ?? "—"}</dd>
                </div>
                <div>
                  <dt className="inline text-muted-foreground">rank: </dt>
                  <dd className="inline font-mono">{row.rank.toFixed(3)}</dd>
                </div>
              </dl>
            </div>
            {profileUserId ? (
              <FavoriteHeartButton
                userId={profileUserId}
                tenderId={row.id}
                initiallyFavorited={favoritedIds.has(row.id)}
              />
            ) : null}
          </div>
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
  const from = first(params.from).trim();
  const back = backFromSavedSearch(from);
  const min = minRaw === "" ? undefined : Number(minRaw);
  const max = maxRaw === "" ? undefined : Number(maxRaw);

  const hasParams =
    q !== "" ||
    cpv !== "" ||
    (min != null && !Number.isNaN(min)) ||
    (max != null && !Number.isNaN(max));

  const filters = { q, cpv, minRaw, maxRaw };

  let rows: SearchTenderRow[] = [];
  let error: string | null = null;
  let profileUserId: string | null = null;
  let favoritedIds = new Set<string>();

  try {
    const authClient = await createSupabaseServerClient();
    const profile = await getOwnProfile(authClient);
    profileUserId = profile.data?.id ?? null;
  } catch {
    profileUserId = null;
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

  if (profileUserId && rows.length > 0) {
    try {
      const client = await createSupabaseServerClient();
      const fav = await listOwnFavoriteTenderIds(
        client,
        rows.map((r) => r.id),
      );
      favoritedIds = fav.data;
    } catch {
      favoritedIds = new Set();
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
      {back ? (
        <p className="mb-4 text-sm">
          <Link href={back.href} className="font-medium text-link hover:underline">
            {back.label}
          </Link>
        </p>
      ) : null}
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Buscar licitaciones
      </h1>

      <SearchForm
        actions={
          <>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark"
            >
              Buscar
            </button>
            {profileUserId ? (
              <SaveSearchButton userId={profileUserId} />
            ) : null}
          </>
        }
      >
        {from === "favorites" || from === "favorites-searches" ? (
          <input type="hidden" name="from" value={from} />
        ) : null}
        <div>
          <label htmlFor="q" className="block text-sm font-medium text-foreground">
            Texto
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="cpv" className="block text-sm font-medium text-foreground">
              CPV (prefijo)
            </label>
            <input
              id="cpv"
              name="cpv"
              type="text"
              inputMode="numeric"
              defaultValue={cpv}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label htmlFor="min" className="block text-sm font-medium text-foreground">
              Importe mín.
            </label>
            <input
              id="min"
              name="min"
              type="number"
              min={0}
              step={1}
              defaultValue={minRaw}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label htmlFor="max" className="block text-sm font-medium text-foreground">
              Importe máx.
            </label>
            <input
              id="max"
              name="max"
              type="number"
              min={0}
              step={1}
              defaultValue={maxRaw}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </SearchForm>

      <ResultsList
        rows={rows}
        error={error}
        searched={hasParams}
        filters={filters}
        profileUserId={profileUserId}
        favoritedIds={favoritedIds}
      />
    </main>
  );
}
