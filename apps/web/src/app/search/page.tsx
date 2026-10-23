import Link from "next/link";
import { FavoriteHeartButton } from "@/components/favorites/favorite-heart-button";
import { PAGE_MAIN_CLASS } from "@/components/shell/page-width";
import { EmptyState, ErrorState } from "@/components/ui/state-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getOwnProfile,
  listOwnFavoriteTenderIds,
  listPlaceMunicipalities,
  listSearchFilterOptions,
  searchTenders,
  type SearchFilterOption,
  type SearchTenderRow,
} from "@/lib/queries";
import { SEARCH_CCAA_OPTIONS } from "@/lib/geo-ccaa";
import { normalizeSearchQuery } from "@/lib/keywords";
import { formatTenderStatus } from "@/lib/tender-labels";
import { normalizeCpvCode } from "@/lib/cpv";
import { CpvPicker } from "./cpv-picker";
import { MunicipalityFilter } from "./municipality-filter";
import { SaveSearchButton } from "./save-search-button";
import { SearchForm } from "./search-form";
import { formatCpvListPreview } from "@/lib/cpv";
import {
  parseSearchPageSize,
  SEARCH_PAGE_SIZE,
  SEARCH_RESULTS_ANCHOR,
  type SearchPageSize,
} from "./search-pagination";
import { ScrollToSearchResults } from "./scroll-to-search-results";
import { SearchResultsPager } from "./search-results-pager";

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

function allParam(value: string | string[] | undefined): string[] {
  if (value == null) return [];
  const raw = Array.isArray(value) ? value : [value];
  const out: string[] = [];
  for (const item of raw) {
    for (const part of item.split(",")) {
      const code = normalizeCpvCode(part);
      if (code && !out.includes(code)) out.push(code);
    }
  }
  return out;
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

/** Solo «errata» (trgm); FTS/filtro no se muestran al usuario. */
function MatchKindBadge({ kind }: { kind: string }) {
  if (kind !== "trgm") return null;
  return (
    <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
      errata
    </span>
  );
}

type SearchFilters = {
  q: string;
  cpvCodes: string[];
  cpvMatch: "any" | "all";
  minRaw: string;
  maxRaw: string;
  ccaa: string;
  municipality: string;
  status: string;
  procedure: string;
  contractType: string;
  pubFrom: string;
  pubTo: string;
  openForSubmission: boolean;
};

function tenderHrefFromSearch(
  tenderId: string,
  filters: SearchFilters,
  page: number,
  pageSize: SearchPageSize,
): string {
  const params = new URLSearchParams({ from: "search" });
  if (filters.q) params.set("q", filters.q);
  for (const code of filters.cpvCodes) params.append("cpv", code);
  if (filters.cpvCodes.length >= 2 && filters.cpvMatch === "all") {
    params.set("cpv_match", "all");
  }
  if (filters.minRaw) params.set("min", filters.minRaw);
  if (filters.maxRaw) params.set("max", filters.maxRaw);
  if (filters.ccaa) params.set("ccaa", filters.ccaa);
  if (filters.municipality) params.set("municipality", filters.municipality);
  if (filters.status) params.set("status", filters.status);
  if (filters.procedure) params.set("procedure", filters.procedure);
  if (filters.contractType) params.set("contract_type", filters.contractType);
  if (filters.pubFrom) params.set("pub_from", filters.pubFrom);
  if (filters.pubTo) params.set("pub_to", filters.pubTo);
  if (filters.openForSubmission) params.set("en_plazo", "1");
  if (page > 1) params.set("page", String(page));
  if (pageSize !== SEARCH_PAGE_SIZE) params.set("ps", String(pageSize));
  return `/tenders/${tenderId}?${params.toString()}`;
}

function optionAllowed(
  value: string,
  options: SearchFilterOption[],
): string {
  return options.some((o) => o.value === value) ? value : "";
}

function ResultsList({
  rows,
  error,
  searched,
  filters,
  page,
  pageSize,
  totalCount,
  from,
  profileUserId,
  favoritedIds,
}: {
  rows: SearchTenderRow[];
  error: string | null;
  searched: boolean;
  filters: SearchFilters;
  page: number;
  pageSize: SearchPageSize;
  totalCount: number;
  from: string;
  profileUserId: string | null;
  favoritedIds: Set<string>;
}) {
  if (error) {
    return (
      <ErrorState className="mt-8">Error al buscar: {error}</ErrorState>
    );
  }

  if (!searched) {
    return null;
  }

  if (rows.length === 0 && page <= 1) {
    return (
      <EmptyState className="mt-8">
        Sin resultados para estos criterios.
      </EmptyState>
    );
  }

  const showPager = totalCount > pageSize || page > 1;

  const list = (
    <ul className="divide-y divide-border">
      {rows.map((row) => (
        <li key={row.id} className="py-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="text-base font-medium text-foreground">
                  <Link
                    href={tenderHrefFromSearch(row.id, filters, page, pageSize)}
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
                  <dd className="inline">
                    {formatMoney(row.estimated_value, row.currency)}
                  </dd>
                </div>
                <div>
                  <dt className="inline text-muted-foreground">CPV: </dt>
                  <dd className="inline font-mono">
                    {formatCpvListPreview(row.cpv_codes)}
                  </dd>
                </div>
                <div>
                  <dt className="inline text-muted-foreground">Estado: </dt>
                  <dd className="inline">{formatTenderStatus(row.status)}</dd>
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

  const pager = (
    <SearchResultsPager
      page={page}
      pageSize={pageSize}
      showing={rows.length}
      total={totalCount}
      filters={filters}
      from={from}
    />
  );

  if (!showPager) {
    return (
      <div id={SEARCH_RESULTS_ANCHOR} className="mt-8 scroll-mt-24">
        <ScrollToSearchResults />
        <div className="rounded-lg border border-border px-4">{list}</div>
      </div>
    );
  }

  return (
    <div id={SEARCH_RESULTS_ANCHOR} className="mt-8 scroll-mt-24">
      <ScrollToSearchResults />
      <div
        className="flex flex-col overflow-hidden rounded-lg border border-border"
        style={{ height: "calc(100dvh - 11.5rem)" }}
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sin resultados en esta página.
            </p>
          ) : (
            list
          )}
        </div>
        <div className="shrink-0 border-t border-border bg-background px-4 py-3">
          {pager}
        </div>
      </div>
    </div>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const qInput = first(params.q).trim();
  const q = normalizeSearchQuery(qInput);
  /** Texto solo con stopwords / tokens < 2 chars → inválido; no se busca. */
  const queryOnlyNoise = qInput !== "" && q === "";
  const cpvCodes = allParam(params.cpv);
  const cpvMatchRaw = first(params.cpv_match).trim().toLowerCase();
  const cpvMatch: "any" | "all" =
    cpvCodes.length >= 2 && cpvMatchRaw === "all" ? "all" : "any";
  const minRaw = first(params.min).trim();
  const maxRaw = first(params.max).trim();
  const ccaa = first(params.ccaa).trim();
  const municipalityRaw = first(params.municipality).trim();
  const statusRaw = first(params.status).trim();
  const procedureRaw = first(params.procedure).trim();
  const contractTypeRaw = first(params.contract_type).trim();
  const pubFromRaw = first(params.pub_from).trim();
  const pubToRaw = first(params.pub_to).trim();
  const openForSubmission = first(params.en_plazo).trim() === "1";
  const from = first(params.from).trim();
  const back = backFromSavedSearch(from);
  const pageRaw = Number.parseInt(first(params.page).trim(), 10);
  const page =
    Number.isInteger(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
  const pageSize = parseSearchPageSize(first(params.ps));
  const min = minRaw === "" ? undefined : Number(minRaw);
  const max = maxRaw === "" ? undefined : Number(maxRaw);

  let filterOptions = {
    statuses: [] as SearchFilterOption[],
    procedureTypes: [] as SearchFilterOption[],
    contractTypes: [] as SearchFilterOption[],
    ccaaCodesWithTenders: new Set<string>(),
  };

  try {
    const client = await createSupabaseServerClient();
    const listed = await listSearchFilterOptions(client);
    if (!listed.error) filterOptions = listed.data;
  } catch {
    /* desplegables vacíos salvo CCAA fijas */
  }

  const ccaaInCatalog = SEARCH_CCAA_OPTIONS.some((o) => o.code === ccaa);
  const ccaaHasData = filterOptions.ccaaCodesWithTenders.has(ccaa);
  const ccaaValid =
    ccaaInCatalog && ccaaHasData ? ccaa : "";

  const statusValid = optionAllowed(statusRaw, filterOptions.statuses);
  const procedureValid = optionAllowed(
    procedureRaw,
    filterOptions.procedureTypes,
  );
  const contractTypeValid = optionAllowed(
    contractTypeRaw,
    filterOptions.contractTypes,
  );
  const pubFromValid = /^\d{4}-\d{2}-\d{2}$/.test(pubFromRaw) ? pubFromRaw : "";
  const pubToValid = /^\d{4}-\d{2}-\d{2}$/.test(pubToRaw) ? pubToRaw : "";

  let municipalityValid = "";
  let municipalityName = "";
  if (ccaaValid && municipalityRaw) {
    try {
      const client = await createSupabaseServerClient();
      const listed = await listPlaceMunicipalities(client, ccaaValid);
      const hit = listed.data.find((m) => m.code === municipalityRaw);
      if (hit) {
        municipalityValid = hit.code;
        municipalityName = hit.name;
      }
    } catch {
      municipalityValid = "";
    }
  }

  const hasParams =
    q !== "" ||
    cpvCodes.length > 0 ||
    (min != null && !Number.isNaN(min)) ||
    (max != null && !Number.isNaN(max)) ||
    ccaaValid !== "" ||
    municipalityValid !== "" ||
    statusValid !== "" ||
    procedureValid !== "" ||
    contractTypeValid !== "" ||
    pubFromValid !== "" ||
    pubToValid !== "" ||
    openForSubmission;
  /** Stopwords solas → aviso y sin RPC (aunque haya otros filtros en la URL). */
  const shouldSearch = hasParams && !queryOnlyNoise;

  const filters: SearchFilters = {
    q: qInput,
    cpvCodes,
    cpvMatch,
    minRaw,
    maxRaw,
    ccaa: ccaaValid,
    municipality: municipalityValid,
    status: statusValid,
    procedure: procedureValid,
    contractType: contractTypeValid,
    pubFrom: pubFromValid,
    pubTo: pubToValid,
    openForSubmission,
  };

  let rows: SearchTenderRow[] = [];
  let totalCount = 0;
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

  if (shouldSearch) {
    const searchInput = {
      query: q || undefined,
      criteria: {
        version: 1 as const,
        cpv_codes: cpvCodes.length ? cpvCodes : undefined,
        cpv_match:
          cpvCodes.length >= 2 && cpvMatch === "all"
            ? ("all" as const)
            : undefined,
        estimated_value_min:
          min != null && !Number.isNaN(min) ? min : undefined,
        estimated_value_max:
          max != null && !Number.isNaN(max) ? max : undefined,
        statuses: statusValid ? [statusValid] : undefined,
        procedure_types: procedureValid ? [procedureValid] : undefined,
        contract_types: contractTypeValid ? [contractTypeValid] : undefined,
        publication_date_from: pubFromValid || undefined,
        publication_date_to: pubToValid || undefined,
        open_for_submission: openForSubmission || undefined,
        geography:
          ccaaValid || municipalityValid
            ? {
                ccaa_codes: ccaaValid ? [ccaaValid] : undefined,
                municipality_codes: municipalityValid
                  ? [municipalityValid]
                  : undefined,
              }
            : undefined,
      },
    };

    try {
      const client = await createSupabaseServerClient();
      const result = await searchTenders(client, {
        ...searchInput,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      if (result.error) {
        error = result.error.message;
      } else {
        // Defensa: nunca mostrar más de una página aunque la RPC devuelva de más.
        rows = (result.data ?? []).slice(0, pageSize);
        totalCount = result.totalCount;
        // Página vacía (p. ej. ?page=99): total_count no viene en filas → sondeo.
        if (rows.length === 0 && page > 1 && totalCount === 0) {
          const probe = await searchTenders(client, {
            ...searchInput,
            limit: 1,
            offset: 0,
          });
          if (!probe.error) totalCount = probe.totalCount;
        }
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
        formKey={`${qInput}|${cpvCodes.join(",")}|${cpvMatch}|${minRaw}|${maxRaw}|${ccaaValid}|${municipalityValid}|${statusValid}|${procedureValid}|${contractTypeValid}|${pubFromValid}|${pubToValid}|${openForSubmission}|${from}`}
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
            defaultValue={qInput}
            aria-invalid={queryOnlyNoise || undefined}
            aria-describedby={queryOnlyNoise ? "q-noise-hint" : undefined}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
          {queryOnlyNoise ? (
            <p
              id="q-noise-hint"
              className="mt-1 text-xs text-destructive"
              role="alert"
            >
              Escribe al menos un término significativo para realizar la
              búsqueda. Evita palabras como «de», «el» o «la».
            </p>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ccaa" className="block text-sm font-medium text-foreground">
              Comunidad Autónoma
            </label>
            <select
              id="ccaa"
              name="ccaa"
              defaultValue={ccaaValid}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todas</option>
              {SEARCH_CCAA_OPTIONS.map((opt) => {
                const hasTenders =
                  filterOptions.ccaaCodesWithTenders.has(opt.code);
                return (
                  <option
                    key={opt.code}
                    value={opt.code}
                    disabled={!hasTenders}
                    className={
                      hasTenders
                        ? undefined
                        : "text-muted-foreground/50"
                    }
                  >
                    {opt.name}
                  </option>
                );
              })}
            </select>
          </div>
          <MunicipalityFilter
            initialCcaa={ccaaValid}
            initialMunicipalityCode={municipalityValid}
            initialMunicipalityName={municipalityName}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label
              htmlFor="status"
              className="block text-sm font-medium text-foreground"
            >
              Estado
            </label>
            <select
              id="status"
              name="status"
              defaultValue={statusValid}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todos</option>
              {filterOptions.statuses.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="procedure"
              className="block text-sm font-medium text-foreground"
            >
              Procedimiento
            </label>
            <select
              id="procedure"
              name="procedure"
              defaultValue={procedureValid}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todos</option>
              {filterOptions.procedureTypes.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="contract_type"
              className="block text-sm font-medium text-foreground"
            >
              Tipo de contrato
            </label>
            <select
              id="contract_type"
              name="contract_type"
              defaultValue={contractTypeValid}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todos</option>
              {filterOptions.contractTypes.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="min" className="block text-sm font-medium text-foreground">
              Importe mín. (sin IVA)
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
              Importe máx. (sin IVA)
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="pub_from"
              className="block text-sm font-medium text-foreground"
            >
              Publicación desde
            </label>
            <input
              id="pub_from"
              name="pub_from"
              type="date"
              defaultValue={pubFromValid}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label
              htmlFor="pub_to"
              className="block text-sm font-medium text-foreground"
            >
              Publicación hasta
            </label>
            <input
              id="pub_to"
              name="pub_to"
              type="date"
              defaultValue={pubToValid}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <CpvPicker initialCodes={cpvCodes} initialMatch={cpvMatch} />
        <label className="inline-flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="en_plazo"
            value="1"
            defaultChecked={openForSubmission}
            className="ef-checkbox"
          />
          Solo en plazo
        </label>
      </SearchForm>

      <ResultsList
        rows={rows}
        error={error}
        searched={shouldSearch}
        filters={filters}
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        from={from}
        profileUserId={profileUserId}
        favoritedIds={favoritedIds}
      />
    </main>
  );
}
