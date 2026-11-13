import Link from "next/link";
import { Suspense } from "react";
import { PAGE_MAIN_CLASS } from "@/components/shell/page-width";
import { getSessionProfile, getSupabaseServerClient } from "@/lib/auth/session";
import {
  listMunicipalityNamesByCodes,
  listOwnRecentSearches,
  listPlaceMunicipalitiesForCcaas,
  recordOwnRecentSearch,
  type RecentSearch,
} from "@/lib/queries";
import { SEARCH_CCAA_OPTIONS } from "@/lib/geo-ccaa";
import { normalizeSearchQuery, tokenizeKeywords } from "@/lib/keywords";
import { normalizeCpvCode } from "@/lib/cpv";
import type { CriteriaFilterInitial } from "@/lib/criteria-display";
import { RecentSearchesList } from "./recent-searches";
import { SaveSearchSlot } from "./save-search-slot";
import {
  SearchFilterFields,
  SearchFilterFieldsFallback,
} from "./search-filter-fields";
import { SearchForm } from "./search-form";
import {
  parseSearchPageSize,
  type SearchHrefFilters,
} from "./search-pagination";
import {
  parseSearchSortBy,
  parseSearchSortDir,
} from "./search-sort";
import { SearchResultsPanel } from "./search-results-panel";
import { SearchWorkspace } from "./search-workspace";

function backFromSavedSearch(from: string): { href: string; label: string } | null {
  if (from === "favorites-searches") {
    return {
      href: "/favorites/searches",
      label: "← Volver a la lista de búsquedas guardadas",
    };
  }
  if (from === "favorites") {
    return {
      href: "/favorites/tenders",
      label: "← Volver a licitaciones favoritas",
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

/** Params multi-valor genéricos (estado / procedimiento / tipo). */
function allStringParam(value: string | string[] | undefined): string[] {
  if (value == null) return [];
  const raw = Array.isArray(value) ? value : [value];
  const out: string[] = [];
  for (const item of raw) {
    const t = item.trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
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
  const ccaaRaw = allStringParam(params.ccaa);
  const municipalityRaw = first(params.municipality).trim();
  const statusesRaw = allStringParam(params.status);
  const proceduresRaw = allStringParam(params.procedure);
  const contractTypesRaw = allStringParam(params.contract_type);
  const pubFromRaw = first(params.pub_from).trim();
  const pubToRaw = first(params.pub_to).trim();
  const enPlazoRaw = first(params.en_plazo).trim();
  /** Ausente o `1` → en plazo; solo `0` desactiva (default marcado). */
  const openForSubmission = enPlazoRaw !== "0";
  const from = first(params.from).trim();
  const back = backFromSavedSearch(from);
  const pageRaw = Number.parseInt(first(params.page).trim(), 10);
  const page =
    Number.isInteger(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
  const pageSize = parseSearchPageSize(first(params.ps));
  const sortBy = parseSearchSortBy(first(params.sort));
  const sortDir = parseSearchSortDir(first(params.dir));
  const tcRaw = Number.parseInt(first(params.tc).trim(), 10);
  /** Marca de paginación/orden (no re-graba recientes). */
  const knownTotal =
    Number.isInteger(tcRaw) && tcRaw >= 0 ? tcRaw : undefined;
  const min = minRaw === "" ? undefined : Number(minRaw);
  const max = maxRaw === "" ? undefined : Number(maxRaw);

  const catalogCcaa = new Set(SEARCH_CCAA_OPTIONS.map((o) => o.code));
  const ccaaValid = ccaaRaw.filter((c) => catalogCcaa.has(c));
  const statusesValid = statusesRaw;
  const proceduresValid = proceduresRaw;
  const contractTypesValid = contractTypesRaw;
  const pubFromValid = /^\d{4}-\d{2}-\d{2}$/.test(pubFromRaw) ? pubFromRaw : "";
  const pubToValid = /^\d{4}-\d{2}-\d{2}$/.test(pubToRaw) ? pubToRaw : "";

  let profileUserId: string | null = null;
  let municipalityValid = "";
  let recentSearches: RecentSearch[] = [];
  let recentMunicipalityNames: Record<string, string> = {};

  let client;
  try {
    client = await getSupabaseServerClient();
  } catch {
    client = null;
  }

  /** «Solo en plazo» por defecto: no dispara búsqueda por sí solo. */
  const hasParams =
    q !== "" ||
    cpvCodes.length > 0 ||
    (min != null && !Number.isNaN(min)) ||
    (max != null && !Number.isNaN(max)) ||
    ccaaValid.length > 0 ||
    municipalityRaw !== "" ||
    statusesValid.length > 0 ||
    proceduresValid.length > 0 ||
    contractTypesValid.length > 0 ||
    pubFromValid !== "" ||
    pubToValid !== "";
  const shouldSearch = hasParams && !queryOnlyNoise;
  /** Nueva búsqueda (form GET sin `tc` / page). */
  const isFreshSearch = shouldSearch && page === 1 && knownTotal == null;

  if (client && shouldSearch && ccaaValid.length > 0 && municipalityRaw) {
    try {
      const listed = await listPlaceMunicipalitiesForCcaas(client, ccaaValid);
      const hit = listed.data.find((m) => m.code === municipalityRaw);
      if (hit) municipalityValid = hit.code;
    } catch {
      municipalityValid = "";
    }
  } else if (municipalityRaw && ccaaValid.length > 0) {
    municipalityValid = municipalityRaw;
  }

  const filters: SearchHrefFilters = {
    q: qInput,
    cpvCodes,
    cpvMatch,
    minRaw,
    maxRaw,
    ccaaCodes: ccaaValid,
    municipality: municipalityValid,
    statuses: statusesValid,
    procedures: proceduresValid,
    contractTypes: contractTypesValid,
    pubFrom: pubFromValid,
    pubTo: pubToValid,
    openForSubmission,
  };

  const keywordTokens = q ? tokenizeKeywords(q) : [];
  const searchCriteria = {
    version: 1 as const,
    keywords: keywordTokens.length ? keywordTokens : undefined,
    cpv_codes: cpvCodes.length ? cpvCodes : undefined,
    cpv_match:
      cpvCodes.length >= 2 && cpvMatch === "all"
        ? ("all" as const)
        : undefined,
    estimated_value_min: min != null && !Number.isNaN(min) ? min : undefined,
    estimated_value_max: max != null && !Number.isNaN(max) ? max : undefined,
    statuses: statusesValid.length ? statusesValid : undefined,
    procedure_types: proceduresValid.length ? proceduresValid : undefined,
    contract_types: contractTypesValid.length ? contractTypesValid : undefined,
    publication_date_from: pubFromValid || undefined,
    publication_date_to: pubToValid || undefined,
    open_for_submission: openForSubmission,
    geography:
      ccaaValid.length > 0 || municipalityValid
        ? {
            ccaa_codes: ccaaValid.length ? ccaaValid : undefined,
            municipality_codes: municipalityValid
              ? [municipalityValid]
              : undefined,
          }
        : undefined,
  };

  const { keywords: _keywords, ...rpcCriteria } = searchCriteria;

  const criteriaKey = [
    q,
    cpvCodes.join(","),
    cpvMatch,
    minRaw,
    maxRaw,
    ccaaValid.join(","),
    municipalityValid,
    statusesValid.join(","),
    proceduresValid.join(","),
    contractTypesValid.join(","),
    pubFromValid,
    pubToValid,
    openForSubmission ? "1" : "0",
  ].join("\u0001");

  if (client) {
    try {
      const profile = await getSessionProfile();
      profileUserId = profile.data?.id ?? null;

      if (isFreshSearch && profileUserId) {
        await recordOwnRecentSearch(client, { criteria: searchCriteria });
      }

      if (profileUserId) {
        const recent = await listOwnRecentSearches(client, {
          userId: profileUserId,
        });
        if (!recent.error) {
          recentSearches = recent.data;
          const munCodes = recentSearches.flatMap(
            (r) => r.criteria.geography?.municipality_codes ?? [],
          );
          recentMunicipalityNames = await listMunicipalityNamesByCodes(
            client,
            munCodes,
          );
        }
      }
    } catch {
      /* historial no bloquea la búsqueda */
    }
  }

  const filterInitial: CriteriaFilterInitial = {
    q: qInput,
    cpvCodes,
    cpvMatch,
    min: minRaw,
    max: maxRaw,
    ccaaCodes: ccaaValid,
    municipalityCode: municipalityRaw,
    municipalityName: "",
    statuses: statusesRaw,
    procedureTypes: proceduresRaw,
    contractTypes: contractTypesRaw,
    pubFrom: pubFromValid,
    pubTo: pubToValid,
    openForSubmission,
  };

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

      <SearchWorkspace>
        <SearchForm
          formKey={`${qInput}|${cpvCodes.join(",")}|${cpvMatch}|${minRaw}|${maxRaw}|${ccaaValid.join(",")}|${municipalityRaw}|${statusesRaw.join(",")}|${proceduresRaw.join(",")}|${contractTypesRaw.join(",")}|${pubFromValid}|${pubToValid}|${enPlazoRaw}|${from}`}
        >
          {from === "favorites" || from === "favorites-searches" ? (
            <input type="hidden" name="from" value={from} />
          ) : null}
          <Suspense
            fallback={
              <SearchFilterFieldsFallback
                initial={filterInitial}
                queryOnlyNoise={queryOnlyNoise}
                textFieldAction={
                  <RecentSearchesList
                    items={recentSearches}
                    municipalityNames={recentMunicipalityNames}
                    trailing={
                      <Suspense fallback={null}>
                        <SaveSearchSlot />
                      </Suspense>
                    }
                  />
                }
              />
            }
          >
            <SearchFilterFields
              initial={filterInitial}
              queryOnlyNoise={queryOnlyNoise}
              textFieldAction={
                <RecentSearchesList
                  items={recentSearches}
                  municipalityNames={recentMunicipalityNames}
                  trailing={
                    <Suspense fallback={null}>
                      <SaveSearchSlot />
                    </Suspense>
                  }
                />
              }
            />
          </Suspense>
        </SearchForm>

        <SearchResultsPanel
          shouldSearch={shouldSearch}
          criteriaKey={criteriaKey}
          query={q}
          rpcCriteria={rpcCriteria}
          filters={filters}
          page={page}
          pageSize={pageSize}
          sortBy={sortBy}
          sortDir={sortDir}
          from={from}
          profileUserId={profileUserId}
        />
      </SearchWorkspace>
    </main>
  );
}
