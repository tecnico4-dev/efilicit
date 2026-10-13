import Link from "next/link";
import { FavoriteHeartButton } from "@/components/favorites/favorite-heart-button";
import { PAGE_MAIN_CLASS } from "@/components/shell/page-width";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getOwnProfile,
  listAuthorityOptions,
  listOwnFavoriteTenderIds,
  listTenderStatuses,
  searchTenders,
  type AuthorityOption,
  type SearchTenderRow,
} from "@/lib/queries";
import type { SearchCriteria } from "@efilicit/types";
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

type SearchFilters = {
  q: string;
  title: string;
  cpv: string;
  minRaw: string;
  maxRaw: string;
  status: string;
  pubFrom: string;
  pubTo: string;
  authorityId: string;
};

function tenderHrefFromSearch(tenderId: string, filters: SearchFilters): string {
  const params = new URLSearchParams({ from: "search" });
  if (filters.q) params.set("q", filters.q);
  if (filters.title) params.set("title", filters.title);
  if (filters.cpv) params.set("cpv", filters.cpv);
  if (filters.minRaw) params.set("min", filters.minRaw);
  if (filters.maxRaw) params.set("max", filters.maxRaw);
  if (filters.status) params.set("status", filters.status);
  if (filters.pubFrom) params.set("pub_from", filters.pubFrom);
  if (filters.pubTo) params.set("pub_to", filters.pubTo);
  if (filters.authorityId) params.set("authority", filters.authorityId);
  return `/tenders/${tenderId}?${params.toString()}`;
}

const fieldClass =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";

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
  filters: SearchFilters;
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
  const title = first(params.title).trim();
  const cpv = first(params.cpv).trim();
  const minRaw = first(params.min).trim();
  const maxRaw = first(params.max).trim();
  const status = first(params.status).trim();
  const pubFrom = first(params.pub_from).trim();
  const pubTo = first(params.pub_to).trim();
  const authorityId = first(params.authority).trim();
  const from = first(params.from).trim();
  const back = backFromSavedSearch(from);
  const min = minRaw === "" ? undefined : Number(minRaw);
  const max = maxRaw === "" ? undefined : Number(maxRaw);

  const hasParams =
    q !== "" ||
    title !== "" ||
    cpv !== "" ||
    (min != null && !Number.isNaN(min)) ||
    (max != null && !Number.isNaN(max)) ||
    status !== "" ||
    pubFrom !== "" ||
    pubTo !== "" ||
    authorityId !== "";

  const filters: SearchFilters = {
    q,
    title,
    cpv,
    minRaw,
    maxRaw,
    status,
    pubFrom,
    pubTo,
    authorityId,
  };

  let rows: SearchTenderRow[] = [];
  let error: string | null = null;
  let profileUserId: string | null = null;
  let favoritedIds = new Set<string>();
  let authorities: AuthorityOption[] = [];
  let statuses: string[] = [];

  try {
    const authClient = await createSupabaseServerClient();
    const profile = await getOwnProfile(authClient);
    profileUserId = profile.data?.id ?? null;
  } catch {
    profileUserId = null;
  }

  try {
    const client = await createSupabaseServerClient();
    const [authRes, statusRes] = await Promise.all([
      listAuthorityOptions(client),
      listTenderStatuses(client),
    ]);
    authorities = authRes.data;
    statuses = statusRes.data;
  } catch {
    authorities = [];
    statuses = [];
  }

  if (hasParams) {
    try {
      const client = await createSupabaseServerClient();
      const criteria: Partial<SearchCriteria> = {
        version: 1,
        title_contains: title || undefined,
        cpv_codes: cpv ? [cpv] : undefined,
        estimated_value_min:
          min != null && !Number.isNaN(min) ? min : undefined,
        estimated_value_max:
          max != null && !Number.isNaN(max) ? max : undefined,
        statuses: status ? [status] : undefined,
        publication_date_from: pubFrom || undefined,
        publication_date_to: pubTo || undefined,
        authority: authorityId ? { ids: [authorityId] } : undefined,
      };
      const result = await searchTenders(client, {
        query: q || undefined,
        criteria,
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

  const formKey = [
    q,
    title,
    cpv,
    minRaw,
    maxRaw,
    status,
    pubFrom,
    pubTo,
    authorityId,
    from,
  ].join("|");

  return (
    <main className={PAGE_MAIN_CLASS}>
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
        formKey={formKey}
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

        <section className="space-y-2">
          <h2 className="text-base font-medium text-foreground">Buscador global</h2>
          <p className="text-xs text-muted-foreground">
            Palabras clave en título y descripción de la licitación.
          </p>
          <div>
            <label htmlFor="q" className="sr-only">
              Buscador global
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              className={fieldClass}
            />
          </div>
        </section>

        <section className="space-y-4 border-t border-border pt-6">
          <h2 className="text-base font-medium text-foreground">Filtros</h2>

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-foreground">
              Título
            </label>
            <input
              id="title"
              name="title"
              type="search"
              defaultValue={title}
              className={fieldClass}
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
                className={`${fieldClass} font-mono`}
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
                className={fieldClass}
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
                className={fieldClass}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-foreground">
                Estado
              </label>
              <select
                id="status"
                name="status"
                defaultValue={status}
                className={fieldClass}
              >
                <option value="">Cualquiera</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="authority" className="block text-sm font-medium text-foreground">
                Órgano contratante
              </label>
              <select
                id="authority"
                name="authority"
                defaultValue={authorityId}
                className={fieldClass}
              >
                <option value="">Cualquiera</option>
                {authorities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pub_from" className="block text-sm font-medium text-foreground">
                Fecha de publicación (desde)
              </label>
              <input
                id="pub_from"
                name="pub_from"
                type="date"
                defaultValue={pubFrom}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="pub_to" className="block text-sm font-medium text-foreground">
                Fecha de publicación (hasta)
              </label>
              <input
                id="pub_to"
                name="pub_to"
                type="date"
                defaultValue={pubTo}
                className={fieldClass}
              />
            </div>
          </div>
        </section>
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
